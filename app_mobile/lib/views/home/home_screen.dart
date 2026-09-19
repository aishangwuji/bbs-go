import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/topic_provider.dart';
import '../auth/login_screen.dart';
import '../settings/server_config_dialog.dart';
import '../topic/topic_create_screen.dart';
import '../user/profile_screen.dart';
import '../widgets/avatar_widget.dart';
import '../widgets/topic_card_widget.dart';

/// 论坛移动端主页大厅
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    // 监听滚动事件实现平滑无限加载
    _scrollController.addListener(_onScroll);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      final topicProvider = context.read<TopicProvider>();
      topicProvider.loadCategories();
      topicProvider.refreshTopics();
      context.read<AuthProvider>().init();
    });
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      context.read<TopicProvider>().loadMoreTopics();
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = context.watch<AuthProvider>();
    final topicProvider = context.watch<TopicProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Row(
          children: [
            Icon(Icons.forum, color: AppTheme.primaryColor, size: 24),
            SizedBox(width: 8),
            Text('bbs-go 社区', style: TextStyle(fontWeight: FontWeight.bold)),
          ],
        ),
        actions: [
          // 快捷服务器配置按钮
          IconButton(
            icon: const Icon(Icons.dns_outlined),
            tooltip: '服务器配置',
            onPressed: () {
              showDialog(
                context: context,
                builder: (_) => ServerConfigDialog(
                  onSaved: () {
                    topicProvider.refreshTopics();
                  },
                ),
              );
            },
          ),
          // 个人中心入口
          GestureDetector(
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const ProfileScreen()),
              );
            },
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: authProvider.isLoggedIn && authProvider.currentUser != null
                  ? AvatarWidget(
                      avatarUrl: authProvider.currentUser!.avatar,
                      nickname: authProvider.currentUser!.nickname,
                      size: 32,
                    )
                  : const CircleAvatar(
                      radius: 16,
                      backgroundColor: Color(0xFFE2E8F0),
                      child: Icon(Icons.person_outline, size: 18, color: Colors.grey),
                    ),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          // 1. 横向滚动分类版块导航
          _buildCategoryTabBar(topicProvider),

          // 2. 话题流列表
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => topicProvider.refreshTopics(),
              child: topicProvider.topics.isEmpty && topicProvider.isRefreshing
                  ? const Center(child: CircularProgressIndicator())
                  : topicProvider.topics.isEmpty
                      ? ListView(
                          children: const [
                            SizedBox(height: 120),
                            Center(
                              child: Column(
                                children: [
                                  Icon(Icons.inbox_outlined, size: 48, color: Colors.grey),
                                  SizedBox(height: 12),
                                  Text(
                                    '暂无相关话题，下拉刷新试一试',
                                    style: TextStyle(color: Colors.grey),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        )
                      : ListView.builder(
                          controller: _scrollController,
                          itemCount: topicProvider.topics.length + (topicProvider.hasMore ? 1 : 0),
                          itemBuilder: (context, index) {
                            if (index == topicProvider.topics.length) {
                              return const Padding(
                                padding: EdgeInsets.symmetric(vertical: 20),
                                child: Center(
                                  child: SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(strokeWidth: 2),
                                  ),
                                ),
                              );
                            }
                            final topic = topicProvider.topics[index];
                            return TopicCardWidget(
                              topic: topic,
                              onLikePressed: () => topicProvider.toggleLike(topic),
                            );
                          },
                        ),
            ),
          ),
        ],
      ),
      // 3. 一键发布话题浮动按钮
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.edit),
        label: const Text('发话题'),
        onPressed: () {
          if (!authProvider.isLoggedIn) {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const LoginScreen()),
            );
          } else {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const TopicCreateScreen()),
            );
          }
        },
      ),
    );
  }

  Widget _buildCategoryTabBar(TopicProvider topicProvider) {
    if (topicProvider.categories.isEmpty) return const SizedBox.shrink();

    return Container(
      height: 46,
      color: Colors.white,
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        scrollDirection: Axis.horizontal,
        itemCount: topicProvider.categories.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final category = topicProvider.categories[index];
          final isSelected = topicProvider.selectedCategoryId == category.id;

          return ChoiceChip(
            label: Text(category.name),
            selected: isSelected,
            selectedColor: AppTheme.primaryColor,
            backgroundColor: Colors.grey.shade100,
            labelStyle: TextStyle(
              color: isSelected ? Colors.white : AppTheme.textPrimary,
              fontSize: 13,
              fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
            ),
            side: BorderSide.none,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            showCheckmark: false,
            onSelected: (_) => topicProvider.selectCategory(category.id),
          );
        },
      ),
    );
  }
}
