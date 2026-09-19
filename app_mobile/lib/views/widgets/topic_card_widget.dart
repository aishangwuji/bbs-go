import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/date_util.dart';
import '../../models/topic_model.dart';
import '../topic/topic_detail_screen.dart';
import 'avatar_widget.dart';

/// 论坛话题卡片组件
class TopicCardWidget extends StatelessWidget {
  final TopicModel topic;
  final VoidCallback? onLikePressed;

  const TopicCardWidget({
    super.key,
    required this.topic,
    this.onLikePressed,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => TopicDetailScreen(topicId: topic.id, initialTopic: topic),
            ),
          );
        },
        child: Padding(
          padding: const EdgeInsets.all(14.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. 作者行
              Row(
                children: [
                  AvatarWidget(
                    avatarUrl: topic.user?.avatar,
                    nickname: topic.user?.nickname ?? '匿名',
                    size: 36,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              topic.user?.nickname ?? '匿名用户',
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 14,
                                color: AppTheme.textPrimary,
                              ),
                            ),
                            if (topic.user?.levelTitle != null &&
                                topic.user!.levelTitle!.isNotEmpty) ...[
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                decoration: BoxDecoration(
                                  color: AppTheme.primaryColor.withOpacity(0.1),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  topic.user!.levelTitle!,
                                  style: const TextStyle(
                                    fontSize: 10,
                                    color: AppTheme.primaryColor,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 2),
                        Row(
                          children: [
                            Text(
                              DateUtil.formatRelativeTime(topic.createTime),
                              style: const TextStyle(
                                fontSize: 12,
                                color: AppTheme.textSecondary,
                              ),
                            ),
                            if (topic.ipLocation != null && topic.ipLocation!.isNotEmpty) ...[
                              const Text(' · ', style: TextStyle(color: AppTheme.textSecondary)),
                              Text(
                                topic.ipLocation!,
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: AppTheme.textSecondary,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ],
                    ),
                  ),
                  // 置顶/精华标识
                  if (topic.sticky)
                    _buildBadge('置顶', Colors.deepOrange)
                  else if (topic.recommend)
                    _buildBadge('精', Colors.green),
                ],
              ),

              const SizedBox(height: 10),

              // 2. 帖子标题
              Text(
                topic.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  height: 1.35,
                  color: AppTheme.textPrimary,
                ),
              ),

              // 3. 摘要预览（如果有）
              if (topic.summary != null && topic.summary!.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  topic.summary!,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppTheme.textSecondary,
                    height: 1.4,
                  ),
                ),
              ],

              const SizedBox(height: 12),

              // 4. 底部数据栏（分类标签 + 浏览量 + 评论数 + 点赞交互）
              Row(
                children: [
                  if (topic.category != null && topic.category!.name.isNotEmpty) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade100,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        topic.category!.name,
                        style: TextStyle(
                          fontSize: 11,
                          color: Colors.grey.shade700,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                  ],

                  const Spacer(),

                  // 浏览量
                  _buildStatItem(Icons.visibility_outlined, '${topic.viewCount}'),
                  const SizedBox(width: 14),

                  // 评论数
                  _buildStatItem(Icons.chat_bubble_outline, '${topic.commentCount}'),
                  const SizedBox(width: 14),

                  // 点赞数
                  InkWell(
                    onTap: onLikePressed,
                    borderRadius: BorderRadius.circular(12),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                      child: Row(
                        children: [
                          Icon(
                            topic.liked ? Icons.thumb_up : Icons.thumb_up_outlined,
                            size: 15,
                            color: topic.liked ? AppTheme.primaryColor : AppTheme.textSecondary,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            '${topic.likeCount}',
                            style: TextStyle(
                              fontSize: 12,
                              color: topic.liked ? AppTheme.primaryColor : AppTheme.textSecondary,
                              fontWeight: topic.liked ? FontWeight.w600 : FontWeight.normal,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBadge(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: color.withOpacity(0.4), width: 0.8),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  Widget _buildStatItem(IconData icon, String count) {
    return Row(
      children: [
        Icon(icon, size: 15, color: AppTheme.textSecondary),
        const SizedBox(width: 4),
        Text(
          count,
          style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
        ),
      ],
    );
  }
}
