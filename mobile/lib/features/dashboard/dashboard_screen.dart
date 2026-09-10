import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/session/session_info.dart';
import '../../core/session/session_provider.dart';
import '../../shared/widgets/today_classes_list.dart';
import '../auth/auth_repository.dart';
import '../today/today_providers.dart';

class _NavTile {
  final String label;
  final IconData icon;
  final Color bg;
  final Color fg;
  const _NavTile(this.label, this.icon, this.bg, this.fg);
}

// Mirrors src/lib/nav-items.ts's NAV_ITEMS / OWNER_NAV_ITEMS — same
// destinations, same one-hue-per-tile convention, so a tile stays
// recognizable to someone who already knows the web app.
const _navItems = [
  _NavTile('Tutors', Icons.school, Color(0xFFEEF2FF), Color(0xFF4F46E5)),
  _NavTile('Students', Icons.people, Color(0xFFF0F9FF), Color(0xFF0284C7)),
  _NavTile(
    'Subjects',
    Icons.local_library,
    Color(0xFFF5F3FF),
    Color(0xFF7C3AED),
  ),
  _NavTile('Classes', Icons.menu_book, Color(0xFFFFF7ED), Color(0xFFEA580C)),
  _NavTile('Fees', Icons.receipt_long, Color(0xFFECFDF5), Color(0xFF059669)),
];

const _ownerNavItems = [
  _NavTile(
    'Salaries',
    Icons.account_balance_wallet,
    Color(0xFFF0FDFA),
    Color(0xFF0D9488),
  ),
  _NavTile('Money', Icons.trending_up, Color(0xFFF0FDF4), Color(0xFF16A34A)),
  _NavTile('Add staff', Icons.person_add, Color(0xFFFFF1F2), Color(0xFFE11D48)),
];

String _roleLabel(SessionInfo session) {
  if (session.isOwner) return 'Owner';
  if (session.isAdminStaff) return 'Admin Staff';
  return 'Tutor';
}

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sessionAsync = ref.watch(sessionInfoProvider);
    final classesAsync = ref.watch(todaysClassesProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: sessionAsync.when(
          data: (session) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                session?.instituteName ?? 'Classly',
                style: const TextStyle(
                  color: Colors.black,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              if (session != null)
                Text(
                  '${session.name} · ${_roleLabel(session)}',
                  style: const TextStyle(
                    color: Colors.grey,
                    fontSize: 12,
                    fontWeight: FontWeight.normal,
                  ),
                ),
            ],
          ),
          loading: () =>
              const Text('Classly', style: TextStyle(color: Colors.black)),
          error: (_, _) =>
              const Text('Classly', style: TextStyle(color: Colors.black)),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.grey),
            onPressed: () => AuthRepository().signOut(),
          ),
        ],
      ),
      body: SafeArea(
        child: sessionAsync.when(
          data: (session) {
            if (session == null) {
              return const Center(
                child: Text(
                  'Not signed in.',
                  style: TextStyle(color: Colors.grey),
                ),
              );
            }
            final tiles = [
              ..._navItems,
              if (session.isOwner) ..._ownerNavItems,
            ];

            return RefreshIndicator(
              onRefresh: () async {
                ref.invalidate(todaysClassesProvider);
                await ref.read(todaysClassesProvider.future);
              },
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                children: [
                  LayoutBuilder(
                    builder: (context, constraints) {
                      const gap = 12.0;
                      const columns = 3;
                      final tileWidth =
                          (constraints.maxWidth - gap * (columns - 1)) /
                          columns;
                      return Wrap(
                        spacing: gap,
                        runSpacing: gap,
                        children: [
                          for (final tile in tiles)
                            SizedBox(
                              width: tileWidth,
                              child: _NavTileButton(tile: tile),
                            ),
                        ],
                      );
                    },
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    "TODAY'S CLASSES",
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: Colors.grey,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 12),
                  classesAsync.when(
                    data: (classes) => TodayClassesList(classes: classes),
                    loading: () => const Padding(
                      padding: EdgeInsets.symmetric(vertical: 40),
                      child: Center(child: CircularProgressIndicator()),
                    ),
                    error: (err, _) => Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(
                        'Could not load today\'s classes.\n$err',
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (err, _) => Center(
            child: Text(
              'Could not load your session.\n$err',
              textAlign: TextAlign.center,
            ),
          ),
        ),
      ),
    );
  }
}

class _NavTileButton extends StatelessWidget {
  final _NavTile tile;
  const _NavTileButton({required this.tile});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: () {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${tile.label} is coming in a future build.')),
        );
      },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFF3F4F6)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(color: tile.bg, shape: BoxShape.circle),
              child: Icon(tile.icon, color: tile.fg, size: 22),
            ),
            const SizedBox(height: 8),
            Text(
              tile.label,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: Color(0xFF374151),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
