import 'package:flutter/material.dart';
import '../../core/storage/sp_storage.dart';

/// 通用用户头像组件
///
/// 支持绝对/相对路径加载、占位图、加载失败 fallback 与默认首字母头像
class AvatarWidget extends StatelessWidget {
  final String? avatarUrl;
  final String nickname;
  final double size;

  const AvatarWidget({
    super.key,
    this.avatarUrl,
    required this.nickname,
    this.size = 40,
  });

  @override
  Widget build(BuildContext context) {
    final String initial = nickname.isNotEmpty ? nickname.characters.first : '?';

    if (avatarUrl == null || avatarUrl!.isEmpty) {
      return _buildInitialAvatar(context, initial);
    }

    String fullUrl = avatarUrl!;
    if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
      final baseUrl = SpStorage.getInstance().then((s) => s.getBaseUrl());
      return FutureBuilder<String>(
        future: baseUrl,
        builder: (context, snapshot) {
          if (!snapshot.hasData) return _buildInitialAvatar(context, initial);
          return _buildNetworkAvatar(context, '${snapshot.data}$avatarUrl', initial);
        },
      );
    }

    return _buildNetworkAvatar(context, fullUrl, initial);
  }

  Widget _buildNetworkAvatar(BuildContext context, String url, String initial) {
    return ClipOval(
      child: Image.network(
        url,
        width: size,
        height: size,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => _buildInitialAvatar(context, initial),
        loadingBuilder: (_, child, progress) {
          if (progress == null) return child;
          return Container(
            width: size,
            height: size,
            color: Colors.grey.shade200,
            child: const Center(
              child: SizedBox(
                width: 14,
                height: 14,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildInitialAvatar(BuildContext context, String initial) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          colors: [
            Theme.of(context).primaryColor,
            Theme.of(context).primaryColor.withOpacity(0.7),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      alignment: Alignment.center,
      child: Text(
        initial,
        style: TextStyle(
          color: Colors.white,
          fontSize: size * 0.45,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}
