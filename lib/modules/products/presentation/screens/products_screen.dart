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
    final theme = Theme.of(context);
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

    return LayoutBuilder(
      builder: (context, constraints) {
        final compact = constraints.maxWidth < 1120;
        final horizontalPadding = compact ? 10.0 : 14.0;
        final verticalPadding = compact ? 10.0 : 12.0;
        final largeDesktop = constraints.maxWidth >= 1440;

        return Padding(
          padding: EdgeInsets.fromLTRB(
            horizontalPadding,
            verticalPadding,
            horizontalPadding,
            8,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildTopWorkspaceStrip(
                context,
                filteredCount: filtered.length,
                compact: compact,
              ),
              if (_error != null) ...[
                const SizedBox(height: 10),
                _buildMessageBanner(
                  context,
                  message: _error!,
                  icon: Icons.error_outline_rounded,
                  color: theme.colorScheme.error,
                ),
              ],
              if (_success != null) ...[
                const SizedBox(height: 10),
                _buildMessageBanner(
                  context,
                  message: _success!,
                  icon: Icons.check_circle_outline_rounded,
                  color: const Color(0xFF2E8B57),
                ),
              ],
              const SizedBox(height: 10),
              Expanded(
                child: compact
                    ? Column(
                        children: [
                          SizedBox(
                            height: 292,
                            width: double.infinity,
                            child: _buildListPanel(filtered, compact: true),
                          ),
                          const SizedBox(height: 10),
                          Expanded(
                            child: _buildDetailPanel(_selected, compact: true),
                          ),
                        ],
                      )
                    : Row(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          SizedBox(
                            width: largeDesktop ? 430 : 390,
                            child: _buildListPanel(filtered),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _buildDetailPanel(_selected),
                          ),
                        ],
                      ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildListPanel(List<ProductRecord> filtered, {bool compact = false}) {
    final theme = Theme.of(context);

    return ExecutiveGlassCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  color: theme.colorScheme.primary.withValues(alpha: 0.10),
                  border: Border.all(
                    color: theme.colorScheme.primary.withValues(alpha: 0.18),
                  ),
                ),
                child: Icon(
                  Icons.inventory_2_outlined,
                  color: theme.colorScheme.primary,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Catálogo comercial',
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 1),
                    Text(
                      '${filtered.length} resultados ${_searchController.text.trim().isEmpty ? 'disponibles' : 'filtrados'}',
                      style: theme.textTheme.bodySmall?.copyWith(
                        fontSize: 11.5,
                        color:
                            theme.colorScheme.onSurface.withValues(alpha: 0.64),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _searchController,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              hintText: 'Buscar producto...',
              prefixIcon: const Icon(Icons.search_rounded),
              isDense: true,
              suffixIcon: _searchController.text.isEmpty
                  ? null
                  : IconButton(
                      onPressed: () {
                        _searchController.clear();
                        setState(() {});
                      },
                      icon: const Icon(Icons.close_rounded),
                    ),
            ),
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              color: theme.colorScheme.surfaceContainerHighest
                  .withValues(alpha: 0.28),
              border: Border.all(
                color: theme.colorScheme.outlineVariant.withValues(alpha: 0.55),
              ),
            ),
            child: Row(
              children: [
                Icon(
                  Icons.tune_rounded,
                  size: 18,
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.65),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Selecciona un producto para revisar precio, inventario, beneficios y multimedia.',
                    style: theme.textTheme.bodySmall?.copyWith(
                      fontSize: 11.8,
                      height: 1.28,
                      color:
                          theme.colorScheme.onSurface.withValues(alpha: 0.68),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          if (_isLoading)
            const Expanded(
              child: Center(
                child: SizedBox(
                  width: 220,
                  child: LinearProgressIndicator(),
                ),
              ),
            )
          else if (filtered.isEmpty)
            Expanded(
              child: Center(
                child: Text(
                  'No hay productos disponibles.',
                  style: theme.textTheme.bodyMedium,
                  textAlign: TextAlign.center,
                ),
              ),
            )
          else
            Expanded(
              child: ListView.separated(
                padding: EdgeInsets.zero,
                itemCount: filtered.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (context, index) {
                  final item = filtered[index];
                  final selected = item.id == _selectedId;
                  final stockWarning = item.stockQuantity != null &&
                      item.lowStockThreshold != null &&
                      item.stockQuantity! <= item.lowStockThreshold!;

                  return InkWell(
                    onTap: () async {
                      setState(() => _selectedId = item.id);
                      final token = await _requireToken();
                      await _ensureImageUrls(token, item);
                    },
                    borderRadius: BorderRadius.circular(16),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 180),
                      curve: Curves.easeOutCubic,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(16),
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: selected
                              ? [
                                  theme.colorScheme.primary
                                      .withValues(alpha: 0.16),
                                  theme.colorScheme.primary
                                      .withValues(alpha: 0.06),
                                ]
                              : [
                                  theme.colorScheme.surface,
                                  theme.colorScheme.surfaceContainerHighest
                                      .withValues(alpha: 0.16),
                                ],
                        ),
                        border: Border.all(
                          color: selected
                              ? theme.colorScheme.primary
                                  .withValues(alpha: 0.34)
                              : theme.colorScheme.outlineVariant
                                  .withValues(alpha: 0.60),
                        ),
                        boxShadow: selected
                            ? [
                                BoxShadow(
                                  color: theme.colorScheme.primary
                                      .withValues(alpha: 0.08),
                                  blurRadius: 24,
                                  offset: const Offset(0, 14),
                                ),
                              ]
                            : null,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      item.name,
                                      maxLines: compact ? 1 : 2,
                                      overflow: TextOverflow.ellipsis,
                                      style:
                                          theme.textTheme.bodyMedium?.copyWith(
                                        fontWeight: FontWeight.w900,
                                      ),
                                    ),
                                    const SizedBox(height: 3),
                                    Text(
                                      item.identifier,
                                      style:
                                          theme.textTheme.bodySmall?.copyWith(
                                        fontSize: 11.5,
                                        color: theme.colorScheme.onSurface
                                            .withValues(alpha: 0.60),
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 8, vertical: 5),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(999),
                                  color: stockWarning
                                      ? const Color(0xFFF9EAD9)
                                      : theme.colorScheme.surface
                                          .withValues(alpha: 0.72),
                                  border: Border.all(
                                    color: stockWarning
                                        ? const Color(0xFFE1BB87)
                                        : theme.colorScheme.outlineVariant
                                            .withValues(alpha: 0.55),
                                  ),
                                ),
                                child: Text(
                                  '${item.currency} ${item.offerPrice ?? item.salesPrice}',
                                  style: theme.textTheme.bodySmall?.copyWith(
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              _miniBadge(
                                context,
                                icon: Icons.category_outlined,
                                text: item.category ?? 'Sin categoría',
                              ),
                              _miniBadge(
                                context,
                                icon: Icons.sell_outlined,
                                text: item.brand ?? 'Sin marca',
                              ),
                              if (item.stockQuantity != null)
                                _miniBadge(
                                  context,
                                  icon: stockWarning
                                      ? Icons.warning_amber_rounded
                                      : Icons.inventory_outlined,
                                  text: item.lowStockThreshold != null
                                      ? 'Stock ${item.stockQuantity} / mín ${item.lowStockThreshold}'
                                      : 'Stock ${item.stockQuantity}',
                                  accentColor: stockWarning
                                      ? const Color(0xFFC27832)
                                      : null,
                                ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            item.description ?? 'Sin descripción comercial.',
                            maxLines: 3,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.bodySmall?.copyWith(
                              fontSize: 11.9,
                              height: 1.35,
                              color: theme.colorScheme.onSurface
                                  .withValues(alpha: 0.74),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildDetailPanel(ProductRecord? product, {bool compact = false}) {
    final theme = Theme.of(context);

    if (product == null) {
      return ExecutiveGlassCard(
        padding: const EdgeInsets.all(24),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 74,
                  height: 74,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(22),
                    color: theme.colorScheme.primary.withValues(alpha: 0.10),
                    border: Border.all(
                      color: theme.colorScheme.primary.withValues(alpha: 0.16),
                    ),
                  ),
                  child: Icon(
                    Icons.inventory_2_outlined,
                    size: 34,
                    color: theme.colorScheme.primary,
                  ),
                ),
                const SizedBox(height: 18),
                Text(
                  'Selecciona un producto',
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  'Aquí verás el resumen comercial, estado de inventario, beneficios y multimedia del producto elegido.',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    height: 1.55,
                    color: theme.colorScheme.onSurface.withValues(alpha: 0.70),
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      );
    }

    return ExecutiveGlassCard(
      padding: const EdgeInsets.all(16),
      child: Align(
        alignment: Alignment.topLeft,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1160),
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                compact
                    ? Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _buildDetailHeader(context, product),
                          const SizedBox(height: 10),
                          _buildDetailActions(product),
                        ],
                      )
                    : Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(child: _buildDetailHeader(context, product)),
                          const SizedBox(width: 12),
                          _buildDetailActions(product),
                        ],
                      ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    _infoCard(
                      context,
                      label: 'Precio base',
                      value: '${product.currency} ${product.salesPrice}',
                      icon: Icons.payments_outlined,
                    ),
                    _infoCard(
                      context,
                      label: 'Oferta activa',
                      value: product.offerPrice ?? 'Sin oferta',
                      icon: Icons.local_offer_outlined,
                    ),
                    _infoCard(
                      context,
                      label: 'Negociación',
                      value: product.negotiationAllowed
                          ? 'Habilitada'
                          : 'No permitida',
                      icon: Icons.handshake_outlined,
                    ),
                    _infoCard(
                      context,
                      label: 'Inventario',
                      value: product.stockQuantity?.toString() ?? 'No definido',
                      icon: Icons.inventory_outlined,
                      detail: product.lowStockThreshold == null
                          ? null
                          : 'Mínimo ${product.lowStockThreshold}',
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                _sectionCard(
                  context,
                  title: 'Resumen comercial',
                  icon: Icons.article_outlined,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        product.description ?? 'Sin descripción comercial.',
                        style:
                            theme.textTheme.bodyMedium?.copyWith(height: 1.6),
                      ),
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          _chip('Categoría', product.category ?? 'No definida'),
                          _chip('Marca', product.brand ?? 'No definida'),
                          _chip('Disponibilidad',
                              product.availabilityText ?? 'No definida'),
                          _chip(
                              'Estado', product.active ? 'Activo' : 'Inactivo'),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Beneficios',
                        style: theme.textTheme.titleSmall
                            ?.copyWith(fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        product.benefits ?? 'No definidos.',
                        style:
                            theme.textTheme.bodyMedium?.copyWith(height: 1.55),
                      ),
                      if (product.tags.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        Text(
                          'Etiquetas',
                          style: theme.textTheme.titleSmall
                              ?.copyWith(fontWeight: FontWeight.w800),
                        ),
                        const SizedBox(height: 6),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: product.tags
                              .map((tag) => _chip('#tag', tag))
                              .toList(growable: false),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                _sectionCard(
                  context,
                  title: 'Galería de imágenes',
                  icon: Icons.photo_library_outlined,
                  trailing: OutlinedButton.icon(
                    onPressed: _isBusy || product.images.length >= 3
                        ? null
                        : () => _uploadImages(product),
                    icon: const Icon(Icons.add_photo_alternate_outlined),
                    label: Text(
                        product.images.length >= 3 ? 'Límite 3/3' : 'Agregar'),
                  ),
                  child: product.images.isEmpty
                      ? Text(
                          'Sin imágenes cargadas.',
                          style: theme.textTheme.bodyMedium,
                        )
                      : Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: product.images.map((image) {
                            final imageUrl = _imageUrls[image.storageKey];
                            return Container(
                              width: compact ? double.infinity : 168,
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(14),
                                color: theme.colorScheme.surfaceContainerHighest
                                    .withValues(alpha: 0.18),
                                border: Border.all(
                                  color: theme.colorScheme.outlineVariant
                                      .withValues(alpha: 0.45),
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Container(
                                    height: 112,
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(12),
                                      color: theme.colorScheme.surface
                                          .withValues(alpha: 0.18),
                                      image: imageUrl == null
                                          ? null
                                          : DecorationImage(
                                              image: NetworkImage(imageUrl),
                                              fit: BoxFit.cover,
                                            ),
                                    ),
                                    child: imageUrl == null
                                        ? const Center(
                                            child: Icon(Icons.image_outlined))
                                        : null,
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    image.fileName,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: theme.textTheme.bodyMedium?.copyWith(
                                      fontSize: 12.5,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  Align(
                                    alignment: Alignment.centerRight,
                                    child: IconButton(
                                      onPressed: _isBusy
                                          ? null
                                          : () => _deleteImage(product, image),
                                      icon: const Icon(
                                          Icons.delete_outline_rounded),
                                    ),
                                  ),
                                ],
                              ),
                            );
                          }).toList(growable: false),
                        ),
                ),
                const SizedBox(height: 12),
                _sectionCard(
                  context,
                  title: 'Videos de venta',
                  icon: Icons.ondemand_video_outlined,
                  trailing: OutlinedButton.icon(
                    onPressed: _isBusy ? null : () => _uploadVideo(product),
                    icon: const Icon(Icons.video_call_outlined),
                    label: const Text('Agregar'),
                  ),
                  child: product.videos.isEmpty
                      ? Text(
                          'Sin videos cargados.',
                          style: theme.textTheme.bodyMedium,
                        )
                      : Column(
                          children: product.videos
                              .map(
                                (video) => Container(
                                  margin: const EdgeInsets.only(bottom: 8),
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 12, vertical: 10),
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(14),
                                    color: theme
                                        .colorScheme.surfaceContainerHighest
                                        .withValues(alpha: 0.18),
                                    border: Border.all(
                                      color: theme.colorScheme.outlineVariant
                                          .withValues(alpha: 0.45),
                                    ),
                                  ),
                                  child: Row(
                                    children: [
                                      Container(
                                        width: 38,
                                        height: 38,
                                        decoration: BoxDecoration(
                                          borderRadius:
                                              BorderRadius.circular(12),
                                          color: theme.colorScheme.primary
                                              .withValues(alpha: 0.10),
                                        ),
                                        child: Icon(
                                          Icons.play_circle_outline_rounded,
                                          color: theme.colorScheme.primary,
                                        ),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              video.title,
                                              style: theme.textTheme.bodyMedium
                                                  ?.copyWith(
                                                fontWeight: FontWeight.w800,
                                              ),
                                            ),
                                            const SizedBox(height: 3),
                                            Text(
                                              video.description ??
                                                  video.fileName,
                                              style: theme.textTheme.bodySmall
                                                  ?.copyWith(
                                                fontSize: 11.8,
                                                color: theme
                                                    .colorScheme.onSurface
                                                    .withValues(alpha: 0.68),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      IconButton(
                                        onPressed: _isBusy
                                            ? null
                                            : () =>
                                                _deleteVideo(product, video),
                                        icon: const Icon(
                                            Icons.delete_outline_rounded),
                                      ),
                                    ],
                                  ),
                                ),
                              )
                              .toList(growable: false),
                        ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDetailHeader(BuildContext context, ProductRecord product) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          product.name,
          style: theme.textTheme.titleLarge?.copyWith(
            fontSize: 26,
            fontWeight: FontWeight.w900,
            height: 1.1,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          '${product.identifier} • ${product.currency}',
          style: theme.textTheme.bodyMedium?.copyWith(
            fontSize: 13,
            color: theme.colorScheme.onSurface.withValues(alpha: 0.64),
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Vista ejecutiva del producto para revisar propuesta de valor, precio, stock y materiales multimedia en un mismo espacio.',
          style: theme.textTheme.bodyMedium?.copyWith(
            fontSize: 12.8,
            height: 1.4,
            color: theme.colorScheme.onSurface.withValues(alpha: 0.72),
          ),
        ),
      ],
    );
  }

  Widget _buildDetailActions(ProductRecord product) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        OutlinedButton.icon(
          onPressed: _isBusy ? null : () => _openEditDialog(product),
          icon: const Icon(Icons.edit_outlined),
          label: const Text('Editar'),
        ),
        OutlinedButton.icon(
          onPressed: _isBusy ? null : () => _deleteProduct(product),
          icon: const Icon(Icons.delete_outline_rounded),
          label: const Text('Eliminar'),
        ),
      ],
    );
  }

  Widget _buildHeadlineMetric(
    BuildContext context, {
    required String label,
    required String value,
    required IconData icon,
    Color? accentColor,
    bool compact = false,
  }) {
    final theme = Theme.of(context);
    final color = accentColor ?? theme.colorScheme.primary;

    return Container(
      constraints: BoxConstraints(
        minWidth: compact ? 150 : 180,
        maxWidth: compact ? 190 : 220,
      ),
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 10 : 12,
        vertical: compact ? 8 : 10,
      ),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: theme.colorScheme.surface.withValues(alpha: 0.90),
        border: Border.all(
          color: theme.colorScheme.outlineVariant.withValues(alpha: 0.62),
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0C0F172A),
            blurRadius: 20,
            offset: Offset(0, 12),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: compact ? 30 : 34,
            height: compact ? 30 : 34,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(compact ? 10 : 11),
              color: color.withValues(alpha: 0.12),
            ),
            child: Icon(icon, color: color, size: compact ? 16 : 18),
          ),
          SizedBox(width: compact ? 8 : 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                value,
                style: theme.textTheme.titleMedium?.copyWith(
                  fontSize: compact ? 18 : null,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 1),
              Text(
                label,
                style: theme.textTheme.bodySmall?.copyWith(
                  fontSize: compact ? 10.8 : 11.5,
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.66),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTopWorkspaceStrip(
    BuildContext context, {
    required int filteredCount,
    required bool compact,
  }) {
    final theme = Theme.of(context);
    final topMetrics = [
      _buildHeadlineMetric(
        context,
        label: 'Catálogo activo',
        value: _products.length.toString(),
        icon: Icons.inventory_2_outlined,
        compact: true,
      ),
      _buildHeadlineMetric(
        context,
        label: 'Resultados',
        value: filteredCount.toString(),
        icon: Icons.search_rounded,
        compact: true,
      ),
      _buildHeadlineMetric(
        context,
        label: 'Stock crítico',
        value: _products
            .where(
              (item) =>
                  item.stockQuantity != null &&
                  item.lowStockThreshold != null &&
                  item.stockQuantity! <= item.lowStockThreshold!,
            )
            .length
            .toString(),
        icon: Icons.warning_amber_rounded,
        accentColor: const Color(0xFFC27832),
        compact: true,
      ),
    ];

    final actionButtons = Wrap(
      spacing: 8,
      runSpacing: 8,
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
    );

    if (compact) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ModuleHeader(
            compact: true,
            title: 'Productos',
            subtitle:
                'Gestiona tu catálogo comercial, precios, inventario y multimedia desde un panel optimizado para ventas y operación diaria.',
            trailing: actionButtons,
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: topMetrics,
          ),
          const SizedBox(height: 10),
        ],
      );
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        color: theme.colorScheme.surface.withValues(alpha: 0.58),
        border: Border.all(
          color: theme.colorScheme.outlineVariant.withValues(alpha: 0.42),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            flex: 4,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(999),
                    color: theme.colorScheme.primary.withValues(alpha: 0.08),
                    border: Border.all(
                      color: theme.colorScheme.primary.withValues(alpha: 0.14),
                    ),
                  ),
                  child: Text(
                    'Workspace',
                    style: theme.textTheme.bodySmall?.copyWith(
                      fontSize: 11.2,
                      color: theme.colorScheme.primary,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Productos',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Gestiona tu catálogo comercial, precios, inventario y multimedia desde un panel optimizado para ventas y operación diaria.',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall?.copyWith(
                    fontSize: 12.2,
                    height: 1.35,
                    color: theme.colorScheme.onSurface.withValues(alpha: 0.70),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            flex: 5,
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  ...topMetrics.map(
                    (metric) => Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: metric,
                    ),
                  ),
                  const SizedBox(width: 6),
                  actionButtons,
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMessageBanner(
    BuildContext context, {
    required String message,
    required IconData icon,
    required Color color,
  }) {
    final theme = Theme.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: color.withValues(alpha: 0.10),
        border: Border.all(color: color.withValues(alpha: 0.24)),
      ),
      child: Row(
        children: [
          Icon(icon, color: color),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              message,
              style: theme.textTheme.bodyMedium?.copyWith(
                fontSize: 12.5,
                color: theme.colorScheme.onSurface,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _miniBadge(
    BuildContext context, {
    required IconData icon,
    required String text,
    Color? accentColor,
  }) {
    final theme = Theme.of(context);
    final color = accentColor ?? theme.colorScheme.onSurface;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        color: theme.colorScheme.surface.withValues(alpha: 0.72),
        border: Border.all(
          color: theme.colorScheme.outlineVariant.withValues(alpha: 0.45),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: color.withValues(alpha: 0.78)),
          const SizedBox(width: 5),
          Text(
            text,
            style: theme.textTheme.labelMedium?.copyWith(
              fontSize: 11.2,
              color: color.withValues(alpha: 0.82),
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _infoCard(
    BuildContext context, {
    required String label,
    required String value,
    required IconData icon,
    String? detail,
  }) {
    final theme = Theme.of(context);

    return Container(
      constraints: const BoxConstraints(minWidth: 148, maxWidth: 200),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color:
            theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.18),
        border: Border.all(
          color: theme.colorScheme.outlineVariant.withValues(alpha: 0.45),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: theme.colorScheme.primary, size: 18),
          const SizedBox(height: 8),
          Text(
            label,
            style: theme.textTheme.bodySmall?.copyWith(
              fontSize: 11.2,
              color: theme.colorScheme.onSurface.withValues(alpha: 0.62),
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w900,
            ),
          ),
          if (detail != null) ...[
            const SizedBox(height: 2),
            Text(
              detail,
              style: theme.textTheme.bodySmall?.copyWith(
                fontSize: 11.2,
                color: theme.colorScheme.onSurface.withValues(alpha: 0.60),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _sectionCard(
    BuildContext context, {
    required String title,
    required IconData icon,
    required Widget child,
    Widget? trailing,
  }) {
    final theme = Theme.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        color: theme.colorScheme.surface.withValues(alpha: 0.78),
        border: Border.all(
          color: theme.colorScheme.outlineVariant.withValues(alpha: 0.42),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10),
                  color: theme.colorScheme.primary.withValues(alpha: 0.10),
                ),
                child: Icon(icon, color: theme.colorScheme.primary, size: 17),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  title,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              if (trailing != null) trailing,
            ],
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }

  Widget _chip(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        color: Theme.of(context)
            .colorScheme
            .surfaceContainerHighest
            .withValues(alpha: 0.20),
        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
      ),
      child: Text(
        '$label: $value',
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
            ),
      ),
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
        content:
            Text('Se eliminará "${product.name}" con su multimedia asociada.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Cancelar')),
          FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Eliminar')),
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
      _success =
          'Importación lista. Creados: ${result['created'] ?? 0}, actualizados: ${result['updated'] ?? 0}.';
      await _loadProducts();
    });
  }

  Future<void> _copyTemplateCsv() async {
    const csv =
        'identifier,name,description,salesPrice,offerPrice,discountPercent,negotiationAllowed,negotiationMarginPercent,currency,category,brand,benefits,availabilityText,stockQuantity,lowStockThreshold\n'
        'SKU-001,Audifonos P9 Ultra 2,Audifonos inalambricos con buena bateria,1500.00,1295.00,13.67,true,10,DOP,Audio,P9,Bluetooth y bateria extendida,Entrega inmediata,18,4';
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
      allowMultiple: true,
      withData: true,
      type: FileType.custom,
      allowedExtensions: const ['mp4', 'mov', 'webm'],
    );
    final files = picked?.files
            .where((file) => file.bytes != null)
            .toList(growable: false) ??
        const [];
    if (files.isEmpty) {
      return;
    }
    if (!mounted) {
      return;
    }
    final metadata = await showDialog<_VideoUploadPlan>(
      context: context,
      builder: (context) => _VideoDialog(files: files),
    );
    if (metadata == null) {
      return;
    }
    await _runBusy((token) async {
      for (var index = 0; index < files.length; index += 1) {
        final file = files[index];
        await _api.uploadVideo(
          token: token,
          productId: product.id,
          file: file,
          title: metadata.buildTitle(file.name, index),
          description: metadata.description,
          sortOrder: product.videos.length + index,
        );
      }
      _success = files.length == 1
          ? 'Video cargado correctamente.'
          : '${files.length} videos cargados correctamente.';
      await _loadProducts();
    });
  }

  Future<void> _deleteImage(
      ProductRecord product, ProductMediaRecord image) async {
    await _runBusy((token) async {
      await _api.deleteImage(token, product.id, image.id);
      _success = 'Imagen eliminada.';
      await _loadProducts();
    });
  }

  Future<void> _deleteVideo(
      ProductRecord product, ProductVideoRecord video) async {
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
  late final TextEditingController _stockQuantity;
  late final TextEditingController _lowStockThreshold;
  late final TextEditingController _tags;
  bool _negotiationAllowed = false;
  bool _active = true;
  bool _identifierTouched = false;

  @override
  void initState() {
    super.initState();
    final product = widget.product;
    _identifier = TextEditingController(text: product?.identifier ?? '');
    _name = TextEditingController(text: product?.name ?? '');
    _description = TextEditingController(text: product?.description ?? '');
    _salesPrice = TextEditingController(text: product?.salesPrice ?? '');
    _offerPrice = TextEditingController(text: product?.offerPrice ?? '');
    _discountPercent =
        TextEditingController(text: product?.discountPercent ?? '');
    _negotiationMarginPercent =
        TextEditingController(text: product?.negotiationMarginPercent ?? '');
    _currency = TextEditingController(text: product?.currency ?? 'DOP');
    _category = TextEditingController(text: product?.category ?? '');
    _brand = TextEditingController(text: product?.brand ?? '');
    _benefits = TextEditingController(text: product?.benefits ?? '');
    _availability =
        TextEditingController(text: product?.availabilityText ?? '');
    _stockQuantity =
        TextEditingController(text: product?.stockQuantity?.toString() ?? '');
    _lowStockThreshold = TextEditingController(
        text: product?.lowStockThreshold?.toString() ?? '');
    _tags = TextEditingController(
        text: product == null ? '' : product.tags.join(', '));
    _negotiationAllowed = product?.negotiationAllowed ?? false;
    _active = product?.active ?? true;
    if (product == null) {
      _name.addListener(_syncIdentifierFromName);
    } else {
      _identifierTouched = true;
    }
  }

  @override
  void dispose() {
    _identifier.dispose();
    _name.dispose();
    _description.dispose();
    _salesPrice.dispose();
    _offerPrice.dispose();
    _discountPercent.dispose();
    _negotiationMarginPercent.dispose();
    _currency.dispose();
    _category.dispose();
    _brand.dispose();
    _benefits.dispose();
    _availability.dispose();
    _stockQuantity.dispose();
    _lowStockThreshold.dispose();
    _tags.dispose();
    super.dispose();
  }

  void _syncIdentifierFromName() {
    if (_identifierTouched) {
      return;
    }
    final generated = _slugifyIdentifier(_name.text);
    if (_identifier.text != generated) {
      _identifier.text = generated;
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title:
          Text(widget.product == null ? 'Crear producto' : 'Editar producto'),
      content: SizedBox(
        width: 700,
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                _field(
                  _identifier,
                  'Identificador',
                  validator: _required,
                  helperText:
                      'Se completa solo desde el nombre si lo dejas sin tocar.',
                  onChanged: (_) => _identifierTouched = true,
                ),
                _field(_name, 'Nombre del producto', validator: _required),
                _field(_salesPrice, 'Precio de venta', validator: _required),
                _field(_offerPrice, 'Precio oferta'),
                _field(_discountPercent, 'Descuento %'),
                _field(_negotiationMarginPercent, 'Margen negociación %'),
                _field(_currency, 'Moneda'),
                _field(_category, 'Categoría'),
                _field(_brand, 'Marca'),
                _field(_availability, 'Disponibilidad'),
                _field(_stockQuantity, 'Stock',
                    validator: _optionalWholeNumber),
                _field(_lowStockThreshold, 'Stock mínimo',
                    validator: _optionalWholeNumber),
                _field(_description, 'Descripción',
                    maxLines: 3, fullWidth: true),
                _field(_benefits, 'Beneficios o puntos de venta',
                    maxLines: 3, fullWidth: true),
                _field(_tags, 'Etiquetas separadas por coma', fullWidth: true),
                SwitchListTile(
                  value: _negotiationAllowed,
                  onChanged: (value) =>
                      setState(() => _negotiationAllowed = value),
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
        TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancelar')),
        FilledButton(
          onPressed: () {
            if (_formKey.currentState?.validate() != true) {
              return;
            }
            final salesPriceValue = double.tryParse(_salesPrice.text.trim());
            final offerPriceValue = _offerPrice.text.trim().isEmpty
                ? null
                : double.tryParse(_offerPrice.text.trim());
            final discountValue = _discountPercent.text.trim().isEmpty
                ? null
                : double.tryParse(_discountPercent.text.trim());
            final negotiationMarginValue =
                _negotiationMarginPercent.text.trim().isEmpty
                    ? null
                    : double.tryParse(_negotiationMarginPercent.text.trim());
            final stockValue = _stockQuantity.text.trim().isEmpty
                ? null
                : int.tryParse(_stockQuantity.text.trim());
            final lowStockValue = _lowStockThreshold.text.trim().isEmpty
                ? null
                : int.tryParse(_lowStockThreshold.text.trim());

            String? errorMessage;
            if (salesPriceValue == null || salesPriceValue < 0) {
              errorMessage = 'El precio de venta debe ser válido.';
            } else if (offerPriceValue != null &&
                offerPriceValue > salesPriceValue) {
              errorMessage = 'La oferta no puede superar el precio de venta.';
            } else if (discountValue != null &&
                (discountValue < 0 || discountValue > 100)) {
              errorMessage = 'El descuento debe estar entre 0 y 100.';
            } else if (negotiationMarginValue != null &&
                (negotiationMarginValue < 0 || negotiationMarginValue > 100)) {
              errorMessage =
                  'El margen de negociación debe estar entre 0 y 100.';
            } else if (stockValue != null &&
                lowStockValue != null &&
                lowStockValue > stockValue) {
              errorMessage =
                  'El stock mínimo no puede ser mayor que el stock disponible.';
            }

            if (errorMessage != null) {
              ScaffoldMessenger.of(context)
                  .showSnackBar(SnackBar(content: Text(errorMessage)));
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
              negotiationMarginPercent:
                  _nullable(_negotiationMarginPercent.text),
              currency:
                  _currency.text.trim().isEmpty ? 'DOP' : _currency.text.trim(),
              category: _nullable(_category.text),
              brand: _nullable(_brand.text),
              benefits: _nullable(_benefits.text),
              availabilityText: _nullable(_availability.text),
              stockQuantity: stockValue,
              lowStockThreshold: lowStockValue,
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
    String? helperText,
    ValueChanged<String>? onChanged,
  }) {
    return SizedBox(
      width: fullWidth ? 720 : 354,
      child: TextFormField(
        controller: controller,
        validator: validator,
        maxLines: maxLines,
        onChanged: onChanged,
        decoration: InputDecoration(labelText: label, helperText: helperText),
      ),
    );
  }
}

class _VideoDialog extends StatefulWidget {
  const _VideoDialog({required this.files});

  final List<PlatformFile> files;

  @override
  State<_VideoDialog> createState() => _VideoDialogState();
}

class _VideoDialogState extends State<_VideoDialog> {
  late final TextEditingController _titlePrefix;
  final _description = TextEditingController();

  @override
  void initState() {
    super.initState();
    _titlePrefix = TextEditingController(
      text: '',
    );
  }

  @override
  void dispose() {
    _titlePrefix.dispose();
    _description.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(
          widget.files.length == 1 ? 'Datos del video' : 'Datos de los videos'),
      content: SizedBox(
        width: 420,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.files.length == 1
                  ? 'Puedes dejar el prefijo vacío y usaré el nombre del archivo.'
                  : 'Seleccionaste ${widget.files.length} videos. Puedes poner un prefijo opcional y una sola descripción para todos.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _titlePrefix,
              decoration: const InputDecoration(
                  labelText: 'Prefijo de título opcional'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _description,
              maxLines: 3,
              decoration:
                  const InputDecoration(labelText: 'Descripción opcional'),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancelar')),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(
            _VideoUploadPlan(
              titlePrefix: _nullable(_titlePrefix.text),
              description: _nullable(_description.text),
            ),
          ),
          child: const Text('Aceptar'),
        ),
      ],
    );
  }
}

class _VideoUploadPlan {
  const _VideoUploadPlan({
    this.titlePrefix,
    this.description,
  });

  final String? titlePrefix;
  final String? description;

  String buildTitle(String fileName, int index) {
    final baseName = fileName.replaceFirst(RegExp(r'\.[^.]+$'), '').trim();
    if (titlePrefix == null || titlePrefix!.isEmpty) {
      return baseName;
    }
    if (index == 0) {
      return '$titlePrefix - $baseName';
    }
    return '$titlePrefix ${index + 1} - $baseName';
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
    this.stockQuantity,
    this.lowStockThreshold,
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
  final int? stockQuantity;
  final int? lowStockThreshold;
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
        'stockQuantity': stockQuantity,
        'lowStockThreshold': lowStockThreshold,
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

String? _optionalWholeNumber(String? value) {
  final trimmed = value?.trim() ?? '';
  if (trimmed.isEmpty) {
    return null;
  }
  final parsed = int.tryParse(trimmed);
  if (parsed == null || parsed < 0) {
    return 'Debe ser un entero mayor o igual a 0';
  }
  return null;
}

String _slugifyIdentifier(String input) {
  final normalized = input
      .toUpperCase()
      .replaceAll(RegExp(r'[^A-Z0-9]+'), '-')
      .replaceAll(RegExp(r'-{2,}'), '-')
      .replaceAll(RegExp(r'^-|-$'), '');
  return normalized.isEmpty ? 'PRODUCTO' : normalized;
}
