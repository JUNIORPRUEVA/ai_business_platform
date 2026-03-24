import 'dart:convert';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../features/bot_configuration_center/data/services/bot_configuration_center_api_client.dart';
import '../../../../features/executive_layout/presentation/widgets/executive_content_container.dart';
import '../../../auth/application/auth_providers.dart';
import '../../../auth/data/auth_api_client.dart';
import '../../../shared/presentation/widgets/module_header.dart';
import '../../data/products_api_client.dart';

class ProductsScreen extends ConsumerStatefulWidget {
  const ProductsScreen({super.key});

  @override
  ConsumerState<ProductsScreen> createState() => _ProductsScreenState();
}

class _ProductsScreenState extends ConsumerState<ProductsScreen> {
  final _api = ProductsApiClient();
  final _searchController = TextEditingController();
  bool _isLoading = true;
  bool _isBusy = false;
  String? _error;
  String? _success;
  List<ProductRecord> _products = const [];
  String? _selectedId;
  final Map<String, String> _imageUrls = <String, String>{};

  ProductRecord? get _selected {
    for (final product in _products) {
      if (product.id == _selectedId) {
        return product;
      }
    }
    return null;
  }

  @override
  void initState() {
    super.initState();
    Future<void>.microtask(_loadProducts);
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<String> _requireToken() async {
    final token = await ref.read(authTokenStoreProvider).read();
    if (token == null || token.trim().isEmpty) {
      throw const AuthApiException('Tu sesión expiró. Inicia sesión otra vez.');
    }
    return token;
  }

  Future<void> _loadProducts() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final token = await _requireToken();
      final products = await _api.list(token);
      final selectedId = products.any((item) => item.id == _selectedId)
          ? _selectedId
          : (products.isEmpty ? null : products.first.id);
      setState(() {
        _products = products;
        _selectedId = selectedId;
      });
      if (_selected != null) {
        await _ensureImageUrls(token, _selected!);
      }
    } on BotConfigurationCenterApiException catch (error) {
      setState(() => _error = error.message);
    } on AuthApiException catch (error) {
      setState(() => _error = error.message);
    } catch (error) {
      setState(() => _error = error.toString());
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _ensureImageUrls(String token, ProductRecord product) async {
    for (final image in product.images) {
      if (_imageUrls.containsKey(image.storageKey)) {
        continue;
      }
      try {
        final url = await _api.resolveDownloadUrl(token, image.storageKey);
        if (url != null && mounted) {
          setState(() => _imageUrls[image.storageKey] = url);
        }
      } catch (_) {}
    }
  }

  Future<void> _runBusy(Future<void> Function(String token) action) async {
    setState(() {
      _isBusy = true;
      _error = null;
      _success = null;
    });
    try {
      final token = await _requireToken();
      await action(token);
    } on BotConfigurationCenterApiException catch (error) {
      setState(() => _error = error.message);
    } on AuthApiException catch (error) {
      setState(() => _error = error.message);
    } catch (error) {
      setState(() => _error = error.toString());
    } finally {
      if (mounted) {
        setState(() => _isBusy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final query = _searchController.text.trim().toLowerCase();
    final filtered = query.isEmpty
        ? _products
        : _products.where((item) {
            return item.identifier.toLowerCase().contains(query) ||
                item.name.toLowerCase().contains(query) ||
                (item.description ?? '').toLowerCase().contains(query) ||
                (item.category ?? '').toLowerCase().contains(query) ||
                (item.brand ?? '').toLowerCase().contains(query);
          }).toList(growable: false);

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ModuleHeader(
            title: 'Productos',
            subtitle:
                'Crea tu catálogo, importa tablas tipo POS y conecta imágenes o videos para que el bot venda con mejor contexto.',
            trailing: Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                FilledButton.icon(
                  onPressed: _isBusy ? null : _openCreateDialog,
                  icon: const Icon(Icons.add_box_outlined),
                  label: const Text('Crear producto'),
                ),
                OutlinedButton.icon(
                  onPressed: _isBusy ? null : _importCsv,
                  icon: const Icon(Icons.file_upload_outlined),
                  label: const Text('Importar CSV'),
                ),
                OutlinedButton.icon(
                  onPressed: _copyTemplateCsv,
                  icon: const Icon(Icons.content_copy_outlined),
                  label: const Text('Plantilla'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          if (_error != null) ...[
            ExecutiveGlassCard(padding: const EdgeInsets.all(14), child: Text(_error!)),
            const SizedBox(height: 12),
          ],
          if (_success != null) ...[
            ExecutiveGlassCard(padding: const EdgeInsets.all(14), child: Text(_success!)),
            const SizedBox(height: 12),
          ],
          LayoutBuilder(
            builder: (context, constraints) {
              final compact = constraints.maxWidth < 1180;
              return Wrap(
                spacing: 14,
                runSpacing: 14,
                children: [
                  SizedBox(
                    width: compact ? constraints.maxWidth : 390,
                    child: _buildListPanel(filtered),
                  ),
                  SizedBox(
                    width: compact ? constraints.maxWidth : constraints.maxWidth - 404,
                    child: _buildDetailPanel(_selected),
                  ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildListPanel(List<ProductRecord> filtered) {
    return ExecutiveGlassCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextField(
            controller: _searchController,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(
              hintText: 'Buscar producto...',
              prefixIcon: Icon(Icons.search_rounded),
            ),
          ),
          const SizedBox(height: 14),
          if (_isLoading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: LinearProgressIndicator(),
            )
          else if (filtered.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Text('No hay productos disponibles.'),
            )
          else
            ...filtered.map((item) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: InkWell(
                    onTap: () async {
                      setState(() => _selectedId = item.id);
                      final token = await _requireToken();
                      await _ensureImageUrls(token, item);
                    },
                    borderRadius: BorderRadius.circular(18),
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(18),
                        color: item.id == _selectedId
                            ? Theme.of(context).colorScheme.primary.withValues(alpha: 0.14)
                            : Theme.of(context).colorScheme.surface.withValues(alpha: 0.12),
                        border: Border.all(
                          color: item.id == _selectedId
                              ? Theme.of(context).colorScheme.primary.withValues(alpha: 0.3)
                              : Theme.of(context).colorScheme.outlineVariant.withValues(alpha: 0.5),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            item.name,
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w900),
                          ),
                          const SizedBox(height: 4),
                          Text('${item.identifier} • ${item.currency} ${item.offerPrice ?? item.salesPrice}'),
                          const SizedBox(height: 6),
                          Text(
                            item.description ?? 'Sin descripción.',
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                  ),
                )),
        ],
      ),
    );
  }

  Widget _buildDetailPanel(ProductRecord? product) {
    if (product == null) {
      return const ExecutiveGlassCard(
        padding: EdgeInsets.all(18),
        child: Text('Selecciona un producto para ver su detalle comercial.'),
      );
    }

    return ExecutiveGlassCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  product.name,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
                ),
              ),
              OutlinedButton.icon(
                onPressed: _isBusy ? null : () => _openEditDialog(product),
                icon: const Icon(Icons.edit_outlined),
                label: const Text('Editar'),
              ),
              const SizedBox(width: 10),
              OutlinedButton.icon(
                onPressed: _isBusy ? null : () => _deleteProduct(product),
                icon: const Icon(Icons.delete_outline_rounded),
                label: const Text('Eliminar'),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _chip('Precio', '${product.currency} ${product.salesPrice}'),
              _chip('Oferta', product.offerPrice ?? 'Sin oferta'),
              _chip('Negociación', product.negotiationAllowed ? 'Sí' : 'No'),
            ],
          ),
          const SizedBox(height: 16),
          Text(product.description ?? 'Sin descripción comercial.'),
          const SizedBox(height: 10),
          Text('Beneficios: ${product.benefits ?? 'No definidos.'}'),
          const SizedBox(height: 10),
          Text('Disponibilidad: ${product.availabilityText ?? 'No definida.'}'),
          const SizedBox(height: 16),
          Row(
            children: [
              Text('Imágenes', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
              const Spacer(),
              OutlinedButton.icon(
                onPressed: _isBusy || product.images.length >= 3 ? null : () => _uploadImages(product),
                icon: const Icon(Icons.add_photo_alternate_outlined),
                label: Text(product.images.length >= 3 ? 'Límite 3/3' : 'Agregar'),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: product.images.isEmpty
                ? const [Text('Sin imágenes cargadas.')]
                : product.images.map((image) {
                    final imageUrl = _imageUrls[image.storageKey];
                    return SizedBox(
                      width: 170,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            height: 110,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(16),
                              color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.14),
                              image: imageUrl == null
                                  ? null
                                  : DecorationImage(image: NetworkImage(imageUrl), fit: BoxFit.cover),
                            ),
                            child: imageUrl == null ? const Center(child: Icon(Icons.image_outlined)) : null,
                          ),
                          const SizedBox(height: 6),
                          Text(image.fileName, maxLines: 1, overflow: TextOverflow.ellipsis),
                          Align(
                            alignment: Alignment.centerRight,
                            child: IconButton(
                              onPressed: _isBusy ? null : () => _deleteImage(product, image),
                              icon: const Icon(Icons.delete_outline_rounded),
                            ),
                          ),
                        ],
                      ),
                    );
                  }).toList(growable: false),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Text('Videos', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
              const Spacer(),
              OutlinedButton.icon(
                onPressed: _isBusy ? null : () => _uploadVideo(product),
                icon: const Icon(Icons.video_call_outlined),
                label: const Text('Agregar'),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (product.videos.isEmpty)
            const Text('Sin videos cargados.')
          else
            ...product.videos.map((video) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.play_circle_outline_rounded),
                  title: Text(video.title),
                  subtitle: Text(video.description ?? video.fileName),
                  trailing: IconButton(
                    onPressed: _isBusy ? null : () => _deleteVideo(product, video),
                    icon: const Icon(Icons.delete_outline_rounded),
                  ),
                )),
        ],
      ),
    );
  }

  Widget _chip(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
      ),
      child: Text('$label: $value'),
    );
  }

  Future<void> _openCreateDialog() async {
    final draft = await showDialog<_ProductDraft>(
      context: context,
      builder: (context) => const _ProductDialog(),
    );
    if (draft == null) {
      return;
    }
    await _runBusy((token) async {
      await _api.create(token, draft.toPayload());
      _success = 'Producto creado correctamente.';
      await _loadProducts();
    });
  }

  Future<void> _openEditDialog(ProductRecord product) async {
    final draft = await showDialog<_ProductDraft>(
      context: context,
      builder: (context) => _ProductDialog(product: product),
    );
    if (draft == null) {
      return;
    }
    await _runBusy((token) async {
      await _api.update(token, product.id, draft.toPayload());
      _success = 'Producto actualizado correctamente.';
      await _loadProducts();
    });
  }

  Future<void> _deleteProduct(ProductRecord product) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Eliminar producto'),
        content: Text('Se eliminará "${product.name}" con su multimedia asociada.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancelar')),
          FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Eliminar')),
        ],
      ),
    );
    if (confirmed != true) {
      return;
    }
    await _runBusy((token) async {
      await _api.delete(token, product.id);
      _success = 'Producto eliminado.';
      await _loadProducts();
    });
  }

  Future<void> _importCsv() async {
    final picked = await FilePicker.platform.pickFiles(
      allowMultiple: false,
      withData: true,
      type: FileType.custom,
      allowedExtensions: const ['csv'],
    );
    final file = picked?.files.single;
    if (file?.bytes == null) {
      return;
    }
    await _runBusy((token) async {
      final result = await _api.importCsv(
        token,
        csvText: utf8.decode(file!.bytes!, allowMalformed: true),
      );
      _success = 'Importación lista. Creados: ${result['created'] ?? 0}, actualizados: ${result['updated'] ?? 0}.';
      await _loadProducts();
    });
  }

  Future<void> _copyTemplateCsv() async {
    const csv = 'identifier,name,description,salesPrice,offerPrice,discountPercent,negotiationAllowed,negotiationMarginPercent,currency,category,brand,benefits,availabilityText\n'
        'SKU-001,Audifonos P9 Ultra 2,Audifonos inalambricos con buena bateria,1500.00,1295.00,13.67,true,10,DOP,Audio,P9,Bluetooth y bateria extendida,Entrega inmediata';
    await Clipboard.setData(const ClipboardData(text: csv));
    if (!mounted) {
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Plantilla CSV copiada al portapapeles.')),
    );
  }

  Future<void> _uploadImages(ProductRecord product) async {
    final remaining = 3 - product.images.length;
    if (remaining <= 0) {
      setState(() => _error = 'Ese producto ya tiene 3 imágenes activas.');
      return;
    }
    final picked = await FilePicker.platform.pickFiles(
      allowMultiple: true,
      withData: true,
      type: FileType.custom,
      allowedExtensions: const ['png', 'jpg', 'jpeg', 'webp'],
    );
    if (picked == null || picked.files.isEmpty) {
      return;
    }
    await _runBusy((token) async {
      final files = picked.files.take(remaining).toList(growable: false);
      for (var index = 0; index < files.length; index += 1) {
        await _api.uploadImage(
          token: token,
          productId: product.id,
          file: files[index],
          sortOrder: product.images.length + index,
          altText: product.name,
        );
      }
      _success = 'Imágenes cargadas correctamente.';
      await _loadProducts();
    });
  }

  Future<void> _uploadVideo(ProductRecord product) async {
    final picked = await FilePicker.platform.pickFiles(
      allowMultiple: false,
      withData: true,
      type: FileType.custom,
      allowedExtensions: const ['mp4', 'mov', 'webm'],
    );
    final file = picked?.files.single;
    if (file == null) {
      return;
    }
    if (!mounted) {
      return;
    }
    final metadata = await showDialog<Map<String, String>>(
      context: context,
      builder: (context) => _VideoDialog(fileName: file.name),
    );
    if (metadata == null) {
      return;
    }
    await _runBusy((token) async {
      await _api.uploadVideo(
        token: token,
        productId: product.id,
        file: file,
        title: metadata['title'] ?? '',
        description: metadata['description'],
        sortOrder: product.videos.length,
      );
      _success = 'Video cargado correctamente.';
      await _loadProducts();
    });
  }

  Future<void> _deleteImage(ProductRecord product, ProductMediaRecord image) async {
    await _runBusy((token) async {
      await _api.deleteImage(token, product.id, image.id);
      _success = 'Imagen eliminada.';
      await _loadProducts();
    });
  }

  Future<void> _deleteVideo(ProductRecord product, ProductVideoRecord video) async {
    await _runBusy((token) async {
      await _api.deleteVideo(token, product.id, video.id);
      _success = 'Video eliminado.';
      await _loadProducts();
    });
  }
}

class _ProductDialog extends StatefulWidget {
  const _ProductDialog({this.product});

  final ProductRecord? product;

  @override
  State<_ProductDialog> createState() => _ProductDialogState();
}

class _ProductDialogState extends State<_ProductDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _identifier;
  late final TextEditingController _name;
  late final TextEditingController _description;
  late final TextEditingController _salesPrice;
  late final TextEditingController _offerPrice;
  late final TextEditingController _discountPercent;
  late final TextEditingController _negotiationMarginPercent;
  late final TextEditingController _currency;
  late final TextEditingController _category;
  late final TextEditingController _brand;
  late final TextEditingController _benefits;
  late final TextEditingController _availability;
  late final TextEditingController _tags;
  bool _negotiationAllowed = false;
  bool _active = true;

  @override
  void initState() {
    super.initState();
    final product = widget.product;
    _identifier = TextEditingController(text: product?.identifier ?? '');
    _name = TextEditingController(text: product?.name ?? '');
    _description = TextEditingController(text: product?.description ?? '');
    _salesPrice = TextEditingController(text: product?.salesPrice ?? '');
    _offerPrice = TextEditingController(text: product?.offerPrice ?? '');
    _discountPercent = TextEditingController(text: product?.discountPercent ?? '');
    _negotiationMarginPercent = TextEditingController(text: product?.negotiationMarginPercent ?? '');
    _currency = TextEditingController(text: product?.currency ?? 'DOP');
    _category = TextEditingController(text: product?.category ?? '');
    _brand = TextEditingController(text: product?.brand ?? '');
    _benefits = TextEditingController(text: product?.benefits ?? '');
    _availability = TextEditingController(text: product?.availabilityText ?? '');
    _tags = TextEditingController(text: product == null ? '' : product.tags.join(', '));
    _negotiationAllowed = product?.negotiationAllowed ?? false;
    _active = product?.active ?? true;
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.product == null ? 'Crear producto' : 'Editar producto'),
      content: SizedBox(
        width: 760,
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                _field(_identifier, 'Identificador', validator: _required),
                _field(_name, 'Nombre', validator: _required),
                _field(_salesPrice, 'Precio venta', validator: _required),
                _field(_offerPrice, 'Precio oferta'),
                _field(_discountPercent, 'Descuento %'),
                _field(_negotiationMarginPercent, 'Margen negociación %'),
                _field(_currency, 'Moneda'),
                _field(_category, 'Categoría'),
                _field(_brand, 'Marca'),
                _field(_availability, 'Disponibilidad'),
                _field(_description, 'Descripción', maxLines: 3, fullWidth: true),
                _field(_benefits, 'Beneficios', maxLines: 3, fullWidth: true),
                _field(_tags, 'Etiquetas separadas por coma', fullWidth: true),
                SwitchListTile(
                  value: _negotiationAllowed,
                  onChanged: (value) => setState(() => _negotiationAllowed = value),
                  title: const Text('Permitir negociación'),
                ),
                SwitchListTile(
                  value: _active,
                  onChanged: (value) => setState(() => _active = value),
                  title: const Text('Producto activo'),
                ),
              ],
            ),
          ),
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancelar')),
        FilledButton(
          onPressed: () {
            if (_formKey.currentState?.validate() != true) {
              return;
            }
            Navigator.of(context).pop(_ProductDraft(
              identifier: _identifier.text.trim(),
              name: _name.text.trim(),
              description: _nullable(_description.text),
              salesPrice: _salesPrice.text.trim(),
              offerPrice: _nullable(_offerPrice.text),
              discountPercent: _nullable(_discountPercent.text),
              negotiationAllowed: _negotiationAllowed,
              negotiationMarginPercent: _nullable(_negotiationMarginPercent.text),
              currency: _currency.text.trim().isEmpty ? 'DOP' : _currency.text.trim(),
              category: _nullable(_category.text),
              brand: _nullable(_brand.text),
              benefits: _nullable(_benefits.text),
              availabilityText: _nullable(_availability.text),
              active: _active,
              tags: _tags.text
                  .split(',')
                  .map((item) => item.trim())
                  .where((item) => item.isNotEmpty)
                  .toList(growable: false),
            ));
          },
          child: const Text('Guardar'),
        ),
      ],
    );
  }

  Widget _field(
    TextEditingController controller,
    String label, {
    String? Function(String?)? validator,
    int maxLines = 1,
    bool fullWidth = false,
  }) {
    return SizedBox(
      width: fullWidth ? 720 : 354,
      child: TextFormField(
        controller: controller,
        validator: validator,
        maxLines: maxLines,
        decoration: InputDecoration(labelText: label),
      ),
    );
  }
}

class _VideoDialog extends StatefulWidget {
  const _VideoDialog({required this.fileName});

  final String fileName;

  @override
  State<_VideoDialog> createState() => _VideoDialogState();
}

class _VideoDialogState extends State<_VideoDialog> {
  late final TextEditingController _title;
  final _description = TextEditingController();

  @override
  void initState() {
    super.initState();
    _title = TextEditingController(
      text: widget.fileName.replaceFirst(RegExp(r'\.[^.]+$'), ''),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Datos del video'),
      content: SizedBox(
        width: 420,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: _title, decoration: const InputDecoration(labelText: 'Título')),
            const SizedBox(height: 12),
            TextField(
              controller: _description,
              maxLines: 3,
              decoration: const InputDecoration(labelText: 'Descripción'),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancelar')),
        FilledButton(
          onPressed: () => Navigator.of(context).pop({
            'title': _title.text.trim(),
            'description': _nullable(_description.text),
          }),
          child: const Text('Aceptar'),
        ),
      ],
    );
  }
}

class _ProductDraft {
  const _ProductDraft({
    required this.identifier,
    required this.name,
    required this.salesPrice,
    required this.negotiationAllowed,
    required this.currency,
    required this.active,
    required this.tags,
    this.description,
    this.offerPrice,
    this.discountPercent,
    this.negotiationMarginPercent,
    this.category,
    this.brand,
    this.benefits,
    this.availabilityText,
  });

  final String identifier;
  final String name;
  final String? description;
  final String salesPrice;
  final String? offerPrice;
  final String? discountPercent;
  final bool negotiationAllowed;
  final String? negotiationMarginPercent;
  final String currency;
  final String? category;
  final String? brand;
  final String? benefits;
  final String? availabilityText;
  final bool active;
  final List<String> tags;

  Map<String, dynamic> toPayload() => {
        'identifier': identifier,
        'name': name,
        'description': description,
        'salesPrice': salesPrice,
        'offerPrice': offerPrice,
        'discountPercent': discountPercent,
        'negotiationAllowed': negotiationAllowed,
        'negotiationMarginPercent': negotiationMarginPercent,
        'currency': currency,
        'category': category,
        'brand': brand,
        'benefits': benefits,
        'availabilityText': availabilityText,
        'active': active,
        'tags': tags,
      };
}

String? _required(String? value) {
  if (value == null || value.trim().isEmpty) {
    return 'Obligatorio';
  }
  return null;
}

String? _nullable(String value) {
  final trimmed = value.trim();
  return trimmed.isEmpty ? null : trimmed;
}
