import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';

import { StorageService } from '../storage/storage.service';
import { CreateProductImageDto } from './dto/create-product-image.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateProductVideoDto } from './dto/create-product-video.dto';
import { ImportProductsDto } from './dto/import-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductImageEntity } from './entities/product-image.entity';
import { ProductEntity } from './entities/product.entity';
import { ProductVideoEntity } from './entities/product-video.entity';

export interface ProductCatalogSnippet {
  id: string;
  identifier: string;
  name: string;
  salesPrice: string;
  offerPrice: string | null;
  currency: string;
  category: string | null;
  brand: string | null;
  description: string | null;
  benefits: string | null;
  availabilityText: string | null;
  negotiationAllowed: boolean;
  negotiationMarginPercent: string | null;
  imageCount: number;
  videoCount: number;
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productsRepository: Repository<ProductEntity>,
    @InjectRepository(ProductImageEntity)
    private readonly productImagesRepository: Repository<ProductImageEntity>,
    @InjectRepository(ProductVideoEntity)
    private readonly productVideosRepository: Repository<ProductVideoEntity>,
    private readonly storageService: StorageService,
  ) {}

  async list(companyId: string) {
    const products = await this.productsRepository.find({
      where: { companyId },
      order: { updatedAt: 'DESC', createdAt: 'DESC' },
    });

    return Promise.all(products.map((product) => this.toProductView(product)));
  }

  async search(companyId: string, query: string, limit = 6): Promise<ProductCatalogSnippet[]> {
    const normalized = query.trim();
    if (!normalized) {
      return [];
    }

    const candidates = await this.productsRepository.find({
      where: [
        { companyId, active: true, identifier: ILike(`%${normalized}%`) },
        { companyId, active: true, name: ILike(`%${normalized}%`) },
        { companyId, active: true, description: ILike(`%${normalized}%`) },
        { companyId, active: true, category: ILike(`%${normalized}%`) },
        { companyId, active: true, brand: ILike(`%${normalized}%`) },
      ],
      order: { updatedAt: 'DESC' },
      take: Math.max(limit * 2, 12),
    });

    const ranked = candidates
      .map((product) => ({
        product,
        score: this.computeSearchScore(product, normalized),
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);

    return Promise.all(ranked.map(({ product }) => this.toCatalogSnippet(product)));
  }

  async get(companyId: string, id: string) {
    const product = await this.productsRepository.findOne({ where: { companyId, id } });
    if (!product) {
      throw new NotFoundException('Producto no encontrado.');
    }
    return this.toProductView(product);
  }

  async create(companyId: string, dto: CreateProductDto) {
    const normalizedIdentifier = dto.identifier.trim();
    await this.ensureIdentifierAvailable(companyId, normalizedIdentifier);

    const entity = this.productsRepository.create({
      companyId,
      identifier: normalizedIdentifier,
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      salesPrice: dto.salesPrice,
      offerPrice: dto.offerPrice?.trim() || null,
      discountPercent: dto.discountPercent?.trim() || null,
      negotiationAllowed: dto.negotiationAllowed ?? false,
      negotiationMarginPercent: dto.negotiationMarginPercent?.trim() || null,
      currency: dto.currency?.trim() || 'DOP',
      category: dto.category?.trim() || null,
      brand: dto.brand?.trim() || null,
      benefits: dto.benefits?.trim() || null,
      availabilityText: dto.availabilityText?.trim() || null,
      active: dto.active ?? true,
      tags: dto.tags?.map((tag: string) => tag.trim()).filter(Boolean) ?? [],
      metadata: {},
    });

    const saved = await this.productsRepository.save(entity);
    return this.toProductView(saved);
  }

  async update(companyId: string, id: string, dto: UpdateProductDto) {
    const product = await this.productsRepository.findOne({ where: { companyId, id } });
    if (!product) {
      throw new NotFoundException('Producto no encontrado.');
    }

    const nextIdentifier = dto.identifier?.trim();
    if (nextIdentifier && nextIdentifier !== product.identifier) {
      await this.ensureIdentifierAvailable(companyId, nextIdentifier, id);
      product.identifier = nextIdentifier;
    }

    if (dto.name !== undefined) product.name = dto.name.trim();
    if (dto.description !== undefined) product.description = dto.description?.trim() || null;
    if (dto.salesPrice !== undefined) product.salesPrice = dto.salesPrice;
    if (dto.offerPrice !== undefined) product.offerPrice = dto.offerPrice?.trim() || null;
    if (dto.discountPercent !== undefined) {
      product.discountPercent = dto.discountPercent?.trim() || null;
    }
    if (dto.negotiationAllowed !== undefined) {
      product.negotiationAllowed = dto.negotiationAllowed;
    }
    if (dto.negotiationMarginPercent !== undefined) {
      product.negotiationMarginPercent = dto.negotiationMarginPercent?.trim() || null;
    }
    if (dto.currency !== undefined) product.currency = dto.currency.trim() || 'DOP';
    if (dto.category !== undefined) product.category = dto.category?.trim() || null;
    if (dto.brand !== undefined) product.brand = dto.brand?.trim() || null;
    if (dto.benefits !== undefined) product.benefits = dto.benefits?.trim() || null;
    if (dto.availabilityText !== undefined) {
      product.availabilityText = dto.availabilityText?.trim() || null;
    }
    if (dto.active !== undefined) product.active = dto.active;
    if (dto.tags !== undefined) {
      product.tags = dto.tags.map((tag: string) => tag.trim()).filter(Boolean);
    }

    const saved = await this.productsRepository.save(product);
    return this.toProductView(saved);
  }

  async remove(companyId: string, id: string) {
    await this.assertProductExists(companyId, id);
    await this.productImagesRepository.delete({ companyId, productId: id });
    await this.productVideosRepository.delete({ companyId, productId: id });
    await this.productsRepository.delete({ companyId, id });
    return { deleted: true } as const;
  }

  async import(companyId: string, dto: ImportProductsDto) {
    const rows = dto.rows?.length
      ? dto.rows
      : dto.csvText?.trim()
        ? this.parseCsvImport(dto.csvText)
        : [];

    if (rows.length === 0) {
      throw new BadRequestException('No se recibieron filas válidas para importar.');
    }

    const importedIds: string[] = [];
    let created = 0;
    let updated = 0;

    for (const row of rows) {
      const identifier = row.identifier.trim();
      const existing = await this.productsRepository.findOne({
        where: { companyId, identifier },
      });

      if (existing && dto.replaceExisting === false) {
        continue;
      }

      if (existing) {
        await this.update(companyId, existing.id, {
          identifier,
          name: row.name,
          description: row.description,
          salesPrice: row.salesPrice,
          offerPrice: row.offerPrice,
          discountPercent: row.discountPercent,
          negotiationAllowed: row.negotiationAllowed,
          negotiationMarginPercent: row.negotiationMarginPercent,
          currency: row.currency,
          category: row.category,
          brand: row.brand,
          benefits: row.benefits,
          availabilityText: row.availabilityText,
        });
        updated += 1;
        importedIds.push(existing.id);
        continue;
      }

      const createdProduct = await this.create(companyId, {
        identifier,
        name: row.name,
        description: row.description,
        salesPrice: row.salesPrice,
        offerPrice: row.offerPrice,
        discountPercent: row.discountPercent,
        negotiationAllowed: row.negotiationAllowed,
        negotiationMarginPercent: row.negotiationMarginPercent,
        currency: row.currency,
        category: row.category,
        brand: row.brand,
        benefits: row.benefits,
        availabilityText: row.availabilityText,
      });
      created += 1;
      importedIds.push(createdProduct.id);
    }

    return {
      created,
      updated,
      totalProcessed: rows.length,
      importedIds,
    };
  }

  async addImage(companyId: string, productId: string, dto: CreateProductImageDto) {
    await this.assertProductExists(companyId, productId);
    this.storageService.assertCompanyKeyOwnership(companyId, dto.storageKey);

    const currentCount = await this.productImagesRepository.count({
      where: { companyId, productId, active: true },
    });
    if (currentCount >= 3) {
      throw new BadRequestException('Cada producto admite un máximo de 3 imágenes activas.');
    }

    const entity = this.productImagesRepository.create({
      companyId,
      productId,
      storageKey: dto.storageKey,
      fileName: dto.fileName.trim(),
      contentType: dto.contentType?.trim() || null,
      altText: dto.altText?.trim() || null,
      sortOrder: dto.sortOrder ?? currentCount,
      active: true,
    });

    return this.productImagesRepository.save(entity);
  }

  async addVideo(companyId: string, productId: string, dto: CreateProductVideoDto) {
    await this.assertProductExists(companyId, productId);
    this.storageService.assertCompanyKeyOwnership(companyId, dto.storageKey);
    if (dto.thumbnailStorageKey) {
      this.storageService.assertCompanyKeyOwnership(companyId, dto.thumbnailStorageKey);
    }

    const entity = this.productVideosRepository.create({
      companyId,
      productId,
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      storageKey: dto.storageKey,
      thumbnailStorageKey: dto.thumbnailStorageKey?.trim() || null,
      fileName: dto.fileName.trim(),
      contentType: dto.contentType?.trim() || null,
      durationSeconds: dto.durationSeconds ?? null,
      sortOrder: dto.sortOrder ?? 0,
      active: true,
    });

    return this.productVideosRepository.save(entity);
  }

  async removeImage(companyId: string, productId: string, imageId: string) {
    const result = await this.productImagesRepository.delete({
      companyId,
      productId,
      id: imageId,
    });
    if (result.affected === 0) {
      throw new NotFoundException('Imagen de producto no encontrada.');
    }
    return { deleted: true } as const;
  }

  async removeVideo(companyId: string, productId: string, videoId: string) {
    const result = await this.productVideosRepository.delete({
      companyId,
      productId,
      id: videoId,
    });
    if (result.affected === 0) {
      throw new NotFoundException('Video de producto no encontrado.');
    }
    return { deleted: true } as const;
  }

  async presignMediaUpload(params: {
    companyId: string;
    filename: string;
    contentType?: string | null;
  }) {
    return this.storageService.presignUpload({
      companyId: params.companyId,
      folder: 'media',
      filename: params.filename,
      contentType: params.contentType ?? undefined,
    });
  }

  private async assertProductExists(companyId: string, productId: string) {
    const exists = await this.productsRepository.exists({ where: { companyId, id: productId } });
    if (!exists) {
      throw new NotFoundException('Producto no encontrado.');
    }
  }

  private async ensureIdentifierAvailable(companyId: string, identifier: string, excludeId?: string) {
    const existing = await this.productsRepository.findOne({ where: { companyId, identifier } });
    if (existing && existing.id !== excludeId) {
      throw new BadRequestException('Ya existe un producto con ese identificador.');
    }
  }

  private parseCsvImport(csvText: string) {
    const lines = csvText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < 2) {
      throw new BadRequestException('El CSV debe incluir encabezados y al menos una fila.');
    }

    const delimiter = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(delimiter).map((header) => header.trim());
    const rows = lines.slice(1).map((line) => {
      const values = line.split(delimiter).map((value) => value.trim());
      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        record[header] = values[index] ?? '';
      });
      return {
        identifier: record['identifier'] || record['identificador'] || '',
        name: record['name'] || record['nombre'] || '',
        description: record['description'] || record['descripcion'] || '',
        salesPrice: record['salesPrice'] || record['precioVenta'] || record['precio_venta'] || '0',
        offerPrice: record['offerPrice'] || record['precioOferta'] || record['precio_oferta'] || '',
        discountPercent:
          record['discountPercent'] || record['descuento'] || record['discount_percent'] || '',
        negotiationAllowed:
          /^(1|true|si|sí|yes)$/i.test(
            record['negotiationAllowed'] || record['negociacionPermitida'] || '',
          ),
        negotiationMarginPercent:
          record['negotiationMarginPercent'] ||
          record['descuentoNegociacion'] ||
          record['margen_negociacion'] ||
          '',
        currency: record['currency'] || record['moneda'] || 'DOP',
        category: record['category'] || record['categoria'] || '',
        brand: record['brand'] || record['marca'] || '',
        benefits: record['benefits'] || record['beneficios'] || '',
        availabilityText: record['availabilityText'] || record['disponibilidad'] || '',
      };
    });

    return rows.filter((row) => row.identifier.trim() && row.name.trim());
  }

  private computeSearchScore(product: ProductEntity, query: string): number {
    const normalized = query.toLowerCase();
    let score = 0;
    const identifier = product.identifier.toLowerCase();
    const name = product.name.toLowerCase();
    const description = (product.description ?? '').toLowerCase();

    if (identifier === normalized) score += 200;
    if (name === normalized) score += 180;
    if (identifier.startsWith(normalized)) score += 120;
    if (name.startsWith(normalized)) score += 100;
    if (identifier.includes(normalized)) score += 80;
    if (name.includes(normalized)) score += 70;
    if (description.includes(normalized)) score += 35;
    if ((product.category ?? '').toLowerCase().includes(normalized)) score += 20;
    if ((product.brand ?? '').toLowerCase().includes(normalized)) score += 20;
    if (product.offerPrice) score += 5;
    return score;
  }

  private async toCatalogSnippet(product: ProductEntity): Promise<ProductCatalogSnippet> {
    const [imageCount, videoCount] = await Promise.all([
      this.productImagesRepository.count({ where: { companyId: product.companyId, productId: product.id } }),
      this.productVideosRepository.count({ where: { companyId: product.companyId, productId: product.id } }),
    ]);

    return {
      id: product.id,
      identifier: product.identifier,
      name: product.name,
      salesPrice: product.salesPrice,
      offerPrice: product.offerPrice,
      currency: product.currency,
      category: product.category,
      brand: product.brand,
      description: product.description,
      benefits: product.benefits,
      availabilityText: product.availabilityText,
      negotiationAllowed: product.negotiationAllowed,
      negotiationMarginPercent: product.negotiationMarginPercent,
      imageCount,
      videoCount,
    };
  }

  private async toProductView(product: ProductEntity) {
    const [images, videos] = await Promise.all([
      this.productImagesRepository.find({
        where: { companyId: product.companyId, productId: product.id },
        order: { sortOrder: 'ASC', createdAt: 'ASC' },
      }),
      this.productVideosRepository.find({
        where: { companyId: product.companyId, productId: product.id },
        order: { sortOrder: 'ASC', createdAt: 'ASC' },
      }),
    ]);

    return {
      ...product,
      images,
      videos,
    };
  }
}
