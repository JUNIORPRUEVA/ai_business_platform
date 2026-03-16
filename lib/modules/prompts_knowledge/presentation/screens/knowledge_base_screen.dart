import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';

import '../../../shared/presentation/widgets/module_header.dart';
import '../../../../features/executive_layout/presentation/widgets/executive_content_container.dart';

class KnowledgeBaseScreen extends StatefulWidget {
  const KnowledgeBaseScreen({super.key});

  @override
  State<KnowledgeBaseScreen> createState() => _KnowledgeBaseScreenState();
}

class _KnowledgeBaseScreenState extends State<KnowledgeBaseScreen> {
  final _searchController = TextEditingController();

  final List<_KnowledgeFile> _files = [
    const _KnowledgeFile(
      name: 'Catálogo de productos.pdf',
      kind: 'pdf',
      bytes: 2400000,
      status: 'indexado',
    ),
    const _KnowledgeFile(
      name: 'Preguntas frecuentes.txt',
      kind: 'txt',
      bytes: 28000,
      status: 'indexado',
    ),
    const _KnowledgeFile(
      name: 'Política de devoluciones.docx',
      kind: 'docx',
      bytes: 92000,
      status: 'indexado',
    ),
  ];

  int? _selectedIndex;

  Future<void> _upload() async {
    final result = await FilePicker.platform.pickFiles(
      allowMultiple: true,
      withData: false,
    );

    if (!mounted || result == null) return;

    setState(() {
      for (final f in result.files) {
        final name = (f.name).trim();
        final ext = (f.extension ?? '').toLowerCase();
        final kind = ext.isEmpty ? 'file' : ext;

        _files.insert(
          0,
          _KnowledgeFile(
            name: name.isEmpty ? 'Untitled.$kind' : name,
            kind: kind,
            bytes: f.size,
            status: 'en cola',
          ),
        );
      }
      _selectedIndex = 0;
    });

    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Se agregaron ${result.files.length} archivo(s) a la base de conocimiento.')),
    );
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    final query = _searchController.text.trim().toLowerCase();
    final filtered = query.isEmpty
        ? List<int>.generate(_files.length, (i) => i)
        : List<int>.generate(_files.length, (i) => i)
            .where((i) => _files[i].name.toLowerCase().contains(query))
            .toList(growable: false);

    final selected = (_selectedIndex != null &&
            _selectedIndex! >= 0 &&
            _selectedIndex! < _files.length)
        ? _files[_selectedIndex!]
        : null;

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ModuleHeader(
            title: 'Base de conocimiento',
            subtitle:
                'Sube y administra fuentes de entrenamiento: PDFs, docs, FAQs, manuales, imágenes, videos.',
            trailing: FilledButton.icon(
              onPressed: _upload,
              icon: const Icon(Icons.upload_file_rounded),
              label: const Text('Subir'),
            ),
          ),
          const SizedBox(height: 14),
          ExecutiveGlassCard(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextField(
                  controller: _searchController,
                  onChanged: (_) => setState(() {}),
                  decoration: const InputDecoration(
                    hintText: 'Buscar documentos…',
                    prefixIcon: Icon(Icons.search_rounded),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  'Archivos',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 10),
                if (filtered.isEmpty)
                  Text(
                    'No hay archivos que coincidan con tu búsqueda.',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurface.withValues(alpha: 0.62),
                    ),
                  )
                else
                  for (final i in filtered) ...[
                    _FileRow(
                      file: _files[i],
                      selected: _selectedIndex == i,
                      onTap: () => setState(() => _selectedIndex = i),
                      onDelete: () {
                        setState(() {
                          _files.removeAt(i);
                          if (_selectedIndex == i) {
                            _selectedIndex = null;
                          } else if (_selectedIndex != null && _selectedIndex! > i) {
                            _selectedIndex = _selectedIndex! - 1;
                          }
                        });
                      },
                    ),
                    const SizedBox(height: 10),
                  ],
              ],
            ),
          ),
          const SizedBox(height: 14),
          ExecutiveGlassCard(
            child: SizedBox(
              height: 200,
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  selected == null
                      ? 'Vista previa\n\nSelecciona un archivo para ver su metadata. (La vista previa de contenido se agrega cuando se conecte el pipeline de indexación del backend.)'
                      : 'Vista previa\n\nNombre: ${selected.name}\nTipo: ${selected.kind}\nTamaño: ${_formatBytes(selected.bytes)}\nEstado: ${selected.status}',
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FileRow extends StatelessWidget {
  const _FileRow({
    required this.file,
    required this.selected,
    required this.onTap,
    required this.onDelete,
  });

  final _KnowledgeFile file;
  final bool selected;
  final VoidCallback onTap;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    final icon = switch (file.kind) {
      'pdf' => Icons.picture_as_pdf_outlined,
      'txt' => Icons.article_outlined,
      'doc' || 'docx' => Icons.description_outlined,
      'png' || 'jpg' || 'jpeg' || 'webp' => Icons.image_outlined,
      'mp4' || 'mov' => Icons.movie_outlined,
      _ => Icons.insert_drive_file_outlined,
    };

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                color: selected
                    ? theme.colorScheme.primary.withValues(alpha: 0.20)
                    : theme.colorScheme.surface.withValues(alpha: 0.16),
                border: Border.all(
                  color: selected
                      ? theme.colorScheme.primary.withValues(alpha: 0.35)
                      : theme.colorScheme.outlineVariant.withValues(alpha: 0.65),
                ),
              ),
              child: Icon(
                icon,
                color: Colors.white.withValues(alpha: 0.86),
                size: 20,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    file.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w900,
                      color: theme.colorScheme.onSurface.withValues(alpha: 0.90),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${file.kind} • ${_formatBytes(file.bytes)} • ${file.status}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurface.withValues(alpha: 0.62),
                    ),
                  ),
                ],
              ),
            ),
            IconButton(
              tooltip: 'Eliminar',
              onPressed: onDelete,
              icon: const Icon(Icons.delete_outline_rounded),
            ),
          ],
        ),
      ),
    );
  }
}

class _KnowledgeFile {
  const _KnowledgeFile({
    required this.name,
    required this.kind,
    required this.bytes,
    required this.status,
  });

  final String name;
  final String kind;
  final int bytes;
  final String status;
}

String _formatBytes(int bytes) {
  if (bytes <= 0) return '0 B';
  const kb = 1024;
  const mb = kb * 1024;
  const gb = mb * 1024;
  if (bytes >= gb) return '${(bytes / gb).toStringAsFixed(1)} GB';
  if (bytes >= mb) return '${(bytes / mb).toStringAsFixed(1)} MB';
  if (bytes >= kb) return '${(bytes / kb).toStringAsFixed(0)} KB';
  return '$bytes B';
}
