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
  stockQuantity: number | null;
  lowStockThreshold: number | null;
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

    const terms = this.extractSearchTerms(normalized);
    const searchTerms = [normalized, ...terms].slice(0, 8);
    const whereClauses = searchTerms.flatMap((term) => [
      { companyId, active: true, identifier: ILike(`%${term}%`) },
      { companyId, active: true, name: ILike(`%${term}%`) },
      { companyId, active: true, description: ILike(`%${term}%`) },
      { companyId, active: true, category: ILike(`%${term}%`) },
      { companyId, active: true, brand: ILike(`%${term}%`) },
      { companyId, active: true, benefits: ILike(`%${term}%`) },
      { companyId, active: true, availabilityText: ILike(`%${term}%`) },
    ]);

    const candidates = await this.productsRepository.find({
      where: whereClauses,
      order: { updatedAt: 'DESC' },
      take: Math.max(limit * 6, 36),
    });

    const ranked = candidates
      .map((product) => ({
        product,
        score: this.computeSearchScore(product, normalized, terms),
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
    this.validateCommercialRules(dto);

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
      stockQuantity: dto.stockQuantity ?? null,
      lowStockThreshold: dto.lowStockThreshold ?? null,
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
    this.validateCommercialRules({
      salesPrice: dto.salesPrice ?? product.salesPrice,
      offerPrice: dto.offerPrice !== undefined ? dto.offerPrice : product.offerPrice ?? undefined,
      discountPercent:
        dto.discountPercent !== undefined ? dto.discountPercent : product.discountPercent ?? undefined,
      negotiationAllowed:
        dto.negotiationAllowed !== undefined ? dto.negotiationAllowed : product.negotiationAllowed,
      negotiationMarginPercent:
        dto.negotiationMarginPercent !== undefined
          ? dto.negotiationMarginPercent
          : product.negotiationMarginPercent ?? undefined,
      stockQuantity: dto.stockQuantity !== undefined ? dto.stockQuantity : product.stockQuantity ?? undefined,
      lowStockThreshold:
        dto.lowStockThreshold !== undefined ? dto.lowStockThreshold : product.lowStockThreshold ?? undefined,
    });

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
    if (dto.stockQuantity !== undefined) product.stockQuantity = dto.stockQuantity;
    if (dto.lowStockThreshold !== undefined) {
      product.lowStockThreshold = dto.lowStockThreshold;
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
          stockQuantity: row.stockQuantity,
          lowStockThreshold: row.lowStockThreshold,
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
        stockQuantity: row.stockQuantity,
        lowStockThreshold: row.lowStockThreshold,
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
    const rows = this.parseCsvRows(csvText);
    if (rows.length < 2) {
      throw new BadRequestException('El CSV debe incluir encabezados y al menos una fila.');
    }

    const headers = rows[0].map((header) => header.trim());
    const mappedRows = rows.slice(1).map((values) => {
      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        record[header] = (values[index] ?? '').trim();
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
        stockQuantity: this.parseOptionalInteger(
          record['stockQuantity'] || record['existencia'] || record['stock'] || record['cantidad'],
        ),
        lowStockThreshold: this.parseOptionalInteger(
          record['lowStockThreshold'] ||
            record['stockMinimo'] ||
            record['stock_minimo'] ||
            record['minStock'],
        ),
      };
    });

    return mappedRows.filter((row) => row.identifier.trim() && row.name.trim());
  }

  private parseCsvRows(csvText: string): string[][] {
    const normalized = csvText.replace(/^\uFEFF/, '');
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentValue = '';
    let inQuotes = false;
    let delimiter = ',';

    const firstLine = normalized.split(/\r?\n/, 1)[0] ?? '';
    if (firstLine.includes(';') && !firstLine.includes(',')) {
      delimiter = ';';
    }

    for (let index = 0; index < normalized.length; index += 1) {
      const char = normalized[index];
      const nextChar = normalized[index + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentValue += '"';
          index += 1;
          continue;
        }
        inQuotes = !inQuotes;
        continue;
      }

      if (!inQuotes && char === delimiter) {
        currentRow.push(currentValue);
        currentValue = '';
        continue;
      }

      if (!inQuotes && (char === '\n' || char === '\r')) {
        if (char === '\r' && nextChar === '\n') {
          index += 1;
        }
        currentRow.push(currentValue);
        if (currentRow.some((value) => value.trim().length > 0)) {
          rows.push(currentRow.map((value) => value.trim()));
        }
        currentRow = [];
        currentValue = '';
        continue;
      }

      currentValue += char;
    }

    currentRow.push(currentValue);
    if (currentRow.some((value) => value.trim().length > 0)) {
      rows.push(currentRow.map((value) => value.trim()));
    }

    return rows;
  }

  private parseOptionalInteger(value: string | undefined): number | undefined {
    const normalized = value?.trim();
    if (!normalized) {
      return undefined;
    }

    const parsed = Number.parseInt(normalized, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new BadRequestException(`Valor entero inválido en importación: "${normalized}".`);
    }

    return parsed;
  }

  private validateCommercialRules(input: {
    salesPrice: string;
    offerPrice?: string | null;
    discountPercent?: string | null;
    negotiationAllowed?: boolean;
    negotiationMarginPercent?: string | null;
    stockQuantity?: number | null;
    lowStockThreshold?: number | null;
  }) {
    const salesPrice = Number.parseFloat(input.salesPrice);
    if (!Number.isFinite(salesPrice) || salesPrice < 0) {
      throw new BadRequestException('El precio de venta debe ser un número válido mayor o igual a 0.');
    }

    if (input.offerPrice?.trim()) {
      const offerPrice = Number.parseFloat(input.offerPrice);
      if (!Number.isFinite(offerPrice) || offerPrice < 0) {
        throw new BadRequestException('El precio de oferta debe ser un número válido mayor o igual a 0.');
      }
      if (offerPrice > salesPrice) {
        throw new BadRequestException('El precio de oferta no puede ser mayor que el precio de venta.');
      }
    }

    if (input.discountPercent?.trim()) {
      const discountPercent = Number.parseFloat(input.discountPercent);
      if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
        throw new BadRequestException('El descuento debe estar entre 0 y 100.');
      }
    }

    if (input.negotiationMarginPercent?.trim()) {
      const negotiationMarginPercent = Number.parseFloat(input.negotiationMarginPercent);
      if (
        !Number.isFinite(negotiationMarginPercent) ||
        negotiationMarginPercent < 0 ||
        negotiationMarginPercent > 100
      ) {
        throw new BadRequestException('El margen de negociación debe estar entre 0 y 100.');
      }
    }

    if (input.stockQuantity != null && input.stockQuantity < 0) {
      throw new BadRequestException('El stock no puede ser negativo.');
    }

    if (input.lowStockThreshold != null && input.lowStockThreshold < 0) {
      throw new BadRequestException('El stock mínimo no puede ser negativo.');
    }

    if (
      input.stockQuantity != null &&
      input.lowStockThreshold != null &&
      input.lowStockThreshold > input.stockQuantity
    ) {
      throw new BadRequestException('El stock mínimo no puede ser mayor que el stock disponible.');
    }
  }

  private extractSearchTerms(query: string): string[] {
    const stopwords = new Set([
      'de',
      'la',
      'el',
      'los',
      'las',
      'un',
      'una',
      'y',
      'o',
      'para',
      'con',
      'en',
      'por',
      'del',
      'al',
      'que',
      'cuanto',
      'cuál',
      'cual',
      'tiene',
      'precio',
      'quiero',
      'necesito',
      'busco',
      'me',
      'mi',
      'tu',
      'su',
    ]);

    return query
      .toLowerCase()
      .split(/[^a-z0-9áéíóúñ]+/i)
      .map((term) => term.trim())
      .filter((term) => term.length >= 2 && !stopwords.has(term));
  }

  private computeSearchScore(product: ProductEntity, query: string, terms: string[]): number {
    const normalized = query.toLowerCase();
    let score = 0;
    const identifier = product.identifier.toLowerCase();
    const name = product.name.toLowerCase();
    const description = (product.description ?? '').toLowerCase();
    const category = (product.category ?? '').toLowerCase();
    const brand = (product.brand ?? '').toLowerCase();
    const benefits = (product.benefits ?? '').toLowerCase();
    const availabilityText = (product.availabilityText ?? '').toLowerCase();

    if (identifier === normalized) score += 200;
    if (name === normalized) score += 180;
    if (identifier.startsWith(normalized)) score += 120;
    if (name.startsWith(normalized)) score += 100;
    if (identifier.includes(normalized)) score += 80;
    if (name.includes(normalized)) score += 70;
    if (description.includes(normalized)) score += 35;
    if (category.includes(normalized)) score += 20;
    if (brand.includes(normalized)) score += 20;
    if (benefits.includes(normalized)) score += 18;
    if (availabilityText.includes(normalized)) score += 12;

    for (const term of terms) {
      if (identifier === term) score += 130;
      if (name === term) score += 120;
      if (identifier.startsWith(term)) score += 65;
      if (name.startsWith(term)) score += 55;
      if (identifier.includes(term)) score += 40;
      if (name.includes(term)) score += 35;
      if (description.includes(term)) score += 16;
      if (category.includes(term)) score += 14;
      if (brand.includes(term)) score += 14;
      if (benefits.includes(term)) score += 12;
      if (availabilityText.includes(term)) score += 8;
    }

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
      stockQuantity: product.stockQuantity,
      lowStockThreshold: product.lowStockThreshold,
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
