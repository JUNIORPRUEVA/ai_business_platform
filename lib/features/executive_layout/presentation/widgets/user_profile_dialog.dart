import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../modules/auth/application/auth_providers.dart';

class UserProfileDialog extends ConsumerStatefulWidget {
  const UserProfileDialog({super.key});

  @override
  ConsumerState<UserProfileDialog> createState() => _UserProfileDialogState();
}

class _UserProfileDialogState extends ConsumerState<UserProfileDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;

  Uint8List? _selectedBytes;
  String? _selectedFileName;
  String? _selectedContentType;
  bool _isSaving = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    final session = ref.read(authControllerProvider).session;
    _nameController = TextEditingController(text: session?.user.name ?? '');
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final session = ref.watch(authControllerProvider).session;
    final user = session?.user;

    return Dialog(
      insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 540),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      'Mi perfil',
                      style: theme.textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const Spacer(),
                    IconButton(
                      onPressed:
                          _isSaving ? null : () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.close_rounded),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  'Actualiza tu nombre y tu imagen de perfil. La imagen se sube al storage de la plataforma.',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.onSurface.withValues(alpha: 0.72),
                    height: 1.45,
                  ),
                ),
                const SizedBox(height: 24),
                Center(
                  child: Column(
                    children: [
                      _ProfileAvatarPreview(
                        name: user?.name ?? '',
                        networkUrl: user?.avatarUrl,
                        memoryBytes: _selectedBytes,
                      ),
                      const SizedBox(height: 12),
                      OutlinedButton.icon(
                        onPressed: _isSaving ? null : _pickImage,
                        icon: const Icon(Icons.upload_rounded),
                        label: Text(
                          _selectedBytes == null
                              ? 'Subir imagen'
                              : 'Cambiar imagen',
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                TextFormField(
                  controller: _nameController,
                  enabled: !_isSaving,
                  decoration: const InputDecoration(labelText: 'Nombre'),
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return 'Ingresa tu nombre';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 14),
                TextFormField(
                  initialValue: user?.email ?? '',
                  enabled: false,
                  decoration: const InputDecoration(labelText: 'Correo'),
                ),
                const SizedBox(height: 14),
                TextFormField(
                  initialValue: session?.company.name ?? '',
                  enabled: false,
                  decoration: const InputDecoration(labelText: 'Empresa'),
                ),
                if (_errorMessage != null) ...[
                  const SizedBox(height: 16),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(14),
                      color: const Color(0xFF7F1D1D).withValues(alpha: 0.30),
                      border: Border.all(
                        color: const Color(0xFFFCA5A5).withValues(alpha: 0.35),
                      ),
                    ),
                    child: Text(_errorMessage!),
                  ),
                ],
                const SizedBox(height: 24),
                Row(
                  children: [
                    TextButton(
                      onPressed:
                          _isSaving ? null : () => Navigator.of(context).pop(),
                      child: const Text('Cancelar'),
                    ),
                    const Spacer(),
                    FilledButton.icon(
                      onPressed: _isSaving ? null : _save,
                      icon: _isSaving
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.save_outlined),
                      label:
                          Text(_isSaving ? 'Guardando...' : 'Guardar cambios'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _pickImage() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.image,
      allowMultiple: false,
      withData: true,
    );
    if (!mounted || result == null || result.files.isEmpty) {
      return;
    }

    final file = result.files.single;
    final bytes = file.bytes;
    if (bytes == null) {
      setState(() {
        _errorMessage =
            'No se pudieron leer los bytes de la imagen seleccionada.';
      });
      return;
    }

    setState(() {
      _selectedBytes = bytes;
      _selectedFileName = file.name;
      _selectedContentType = _guessContentType(file.extension);
      _errorMessage = null;
    });
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _isSaving = true;
      _errorMessage = null;
    });

    try {
      await ref.read(authControllerProvider.notifier).updateProfile(
            name: _nameController.text.trim(),
            avatarBytes: _selectedBytes,
            avatarFileName: _selectedFileName,
            avatarContentType: _selectedContentType,
          );

      if (!mounted) {
        return;
      }

      Navigator.of(context).pop();
      ScaffoldMessenger.maybeOf(context)?.showSnackBar(
        const SnackBar(content: Text('Perfil actualizado correctamente.')),
      );
    } on AuthApiException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _errorMessage = error.message;
      });
    } finally {
      if (!mounted) {
        return;
      }
      setState(() {
        _isSaving = false;
      });
    }
  }

  String _guessContentType(String? extension) {
    switch ((extension ?? '').toLowerCase()) {
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'gif':
        return 'image/gif';
      case 'jpg':
      case 'jpeg':
      default:
        return 'image/jpeg';
    }
  }
}

class _ProfileAvatarPreview extends StatelessWidget {
  const _ProfileAvatarPreview({
    required this.name,
    this.networkUrl,
    this.memoryBytes,
  });

  final String name;
  final String? networkUrl;
  final Uint8List? memoryBytes;

  @override
  Widget build(BuildContext context) {
    final initials = name.trim().isEmpty
        ? 'U'
        : name
            .trim()
            .split(RegExp(r'\s+'))
            .take(2)
            .map((part) => part.characters.first.toUpperCase())
            .join();

    ImageProvider<Object>? imageProvider;
    if (memoryBytes != null) {
      imageProvider = MemoryImage(memoryBytes!);
    } else if (networkUrl != null && networkUrl!.isNotEmpty) {
      imageProvider = NetworkImage(networkUrl!);
    }

    return CircleAvatar(
      radius: 46,
      backgroundColor: const Color(0xFF2563EB),
      foregroundImage: imageProvider,
      child: imageProvider == null
          ? Text(
              initials,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w800,
                fontSize: 24,
              ),
            )
          : null,
    );
  }
}
