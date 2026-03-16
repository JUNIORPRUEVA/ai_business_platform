import 'package:flutter/material.dart';

import '../../domain/entities/bot_contact_context.dart';

class ContactContextPanel extends StatelessWidget {
  const ContactContextPanel({
    required this.contact,
    super.key,
  });

  final BotContactContext contact;

  @override
  Widget build(BuildContext context) {
    if (contact.name == 'No disponible' &&
        contact.tags.isEmpty &&
        contact.productKnowledge.isEmpty) {
      return Center(
        child: Text(
          'Aún no hay contexto de contacto disponible para esta conversación.',
          style: Theme.of(context).textTheme.bodyMedium,
          textAlign: TextAlign.center,
        ),
      );
    }

    return ListView(
      children: [
        _ContactInfoTile(label: 'Nombre del cliente', value: contact.name),
        _ContactInfoTile(label: 'Teléfono', value: contact.phoneNumber),
        _ContactInfoTile(label: 'Rol', value: contact.role),
        _ContactInfoTile(label: 'Tipo de negocio', value: contact.businessType),
        _ContactInfoTile(label: 'Ciudad', value: contact.city),
        const SizedBox(height: 18),
        Text('Etiquetas', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 12),
        if (contact.tags.isEmpty)
          Text('Sin etiquetas asignadas.',
              style: Theme.of(context).textTheme.bodyMedium)
        else
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children:
                contact.tags.map((tag) => Chip(label: Text(tag))).toList(),
          ),
        const SizedBox(height: 18),
        Text('Conocimiento del producto',
            style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 12),
        if (contact.productKnowledge.isEmpty)
          Text(
            'Aún no hay guía específica del producto cargada para este contacto.',
            style: Theme.of(context).textTheme.bodyMedium,
          )
        else
          ...contact.productKnowledge
              .map((product) => _ProductKnowledgeCard(product: product)),
      ],
    );
  }
}

class _ProductKnowledgeCard extends StatelessWidget {
  const _ProductKnowledgeCard({required this.product});

  final BotProductKnowledge product;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFD8E3F2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(product.name, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 6),
          Text(product.summary, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 14),
          _KnowledgeList(
            label: 'Capacidades clave',
            items: product.keyCapabilities,
            chipColor: const Color(0xFFE8F0FF),
          ),
          const SizedBox(height: 12),
          _KnowledgeList(
            label: 'Señales de calificación',
            items: product.qualificationSignals,
            chipColor: const Color(0xFFEAF7EE),
          ),
          const SizedBox(height: 12),
          _KnowledgeList(
            label: 'Puntos de precaución',
            items: product.cautionPoints,
            chipColor: const Color(0xFFFFF1E8),
          ),
        ],
      ),
    );
  }
}

class _KnowledgeList extends StatelessWidget {
  const _KnowledgeList({
    required this.label,
    required this.items,
    required this.chipColor,
  });

  final String label;
  final List<String> items;
  final Color chipColor;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: 8),
        if (items.isEmpty)
          Text('No hay elementos cargados.',
              style: Theme.of(context).textTheme.bodyMedium)
        else
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: items
                .map(
                  (item) => Chip(
                    backgroundColor: chipColor,
                    label: Text(item),
                    visualDensity: VisualDensity.compact,
                  ),
                )
                .toList(growable: false),
          ),
      ],
    );
  }
}

class _ContactInfoTile extends StatelessWidget {
  const _ContactInfoTile({
    required this.label,
    required this.value,
  });

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 6),
          Text(value, style: Theme.of(context).textTheme.titleMedium),
        ],
      ),
    );
  }
}
