import 'package:flutter/material.dart';
import 'package:fluttertoast/fluttertoast.dart';
import 'package:provider/provider.dart';
import '../../core/constants/api_constants.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/topic_provider.dart';
import '../auth/login_screen.dart';

/// 发布新话题页面
class TopicCreateScreen extends StatefulWidget {
  const TopicCreateScreen({super.key});

  @override
  State<TopicCreateScreen> createState() => _TopicCreateScreenState();
}

class _TopicCreateScreenState extends State<TopicCreateScreen> {
  final TextEditingController _titleController = TextEditingController();
  final TextEditingController _contentController = TextEditingController();
  int? _selectedCategoryId;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    final categories = context.read<TopicProvider>().categories;
    final validCategories = categories.where((c) => c.id > 0).toList();
    if (validCategories.isNotEmpty) {
      _selectedCategoryId = validCategories.first.id;
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _contentController.dispose();
    super.dispose();
  }

  /// 插入 Markdown 常用符号/语法
  void _insertMarkdown(String prefix, String suffix) {
    final text = _contentController.text;
    final selection = _contentController.selection;
    final start = selection.start >= 0 ? selection.start : text.length;
    final end = selection.end >= 0 ? selection.end : text.length;
    final selectedText = text.substring(start, end);

    final newText = text.replaceRange(start, end, '$prefix$selectedText$suffix');
    _contentController.value = TextEditingValue(
      text: newText,
      selection: TextSelection.collapsed(offset: start + prefix.length + selectedText.length),
    );
  }

  Future<void> _submit() async {
    final authProvider = context.read<AuthProvider>();
    if (!authProvider.isLoggedIn) {
      Navigator.push(context, MaterialPageRoute(builder: (_) => const LoginScreen()));
      return;
    }

    final title = _titleController.text.trim();
    final content = _contentController.text.trim();

    if (title.isEmpty) {
      Fluttertoast.showToast(msg: '请输入帖子标题');
      return;
    }
    if (content.isEmpty) {
      Fluttertoast.showToast(msg: '请输入帖子正文内容');
      return;
    }
    if (_selectedCategoryId == null || _selectedCategoryId! <= 0) {
      Fluttertoast.showToast(msg: '请选择帖子所属分类版块');
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final response = await ApiClient.instance.post(
        ApiConstants.topicCreate,
        data: {
          'title': title,
          'content': content,
          'categoryId': _selectedCategoryId,
          'type': 0,
          'contentType': 'markdown',
        },
      );

      setState(() => _isSubmitting = false);

      if (response.isSuccess) {
        Fluttertoast.showToast(msg: '发布成功！');
        if (mounted) {
          context.read<TopicProvider>().refreshTopics();
          Navigator.of(context).pop();
        }
      }
    } catch (e) {
      setState(() => _isSubmitting = false);
      Fluttertoast.showToast(msg: '发布失败: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final categories = context
        .watch<TopicProvider>()
        .categories
        .where((c) => c.id > 0)
        .toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('发表新话题'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: _isSubmitting
                ? const Center(
                    child: SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                : TextButton(
                    onPressed: _submit,
                    child: const Text(
                      '发布',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.primaryColor,
                      ),
                    ),
                  ),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // 1. 版块选择
                if (categories.isNotEmpty) ...[
                  const Text(
                    '选择版块节点',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppTheme.textSecondary),
                  ),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<int>(
                    value: _selectedCategoryId,
                    decoration: const InputDecoration(
                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    ),
                    items: categories
                        .map(
                          (c) => DropdownMenuItem<int>(
                            value: c.id,
                            child: Text(c.name),
                          ),
                        )
                        .toList(),
                    onChanged: (val) {
                      setState(() => _selectedCategoryId = val);
                    },
                  ),
                  const SizedBox(height: 16),
                ],

                // 2. 标题输入框
                TextField(
                  controller: _titleController,
                  maxLines: null,
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                  decoration: const InputDecoration(
                    hintText: '请输入标题...',
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    filled: false,
                    contentPadding: EdgeInsets.zero,
                  ),
                ),

                const Divider(height: 24),

                // 3. 正文输入框
                TextField(
                  controller: _contentController,
                  maxLines: null,
                  minLines: 12,
                  style: const TextStyle(fontSize: 15, height: 1.6),
                  decoration: const InputDecoration(
                    hintText: '支持 Markdown 语法排版，分享你的观点与思考...',
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    filled: false,
                    contentPadding: EdgeInsets.zero,
                  ),
                ),
              ],
            ),
          ),

          // 4. Markdown 底部快捷编辑条
          _buildMarkdownToolBar(),
        ],
      ),
    );
  }

  Widget _buildMarkdownToolBar() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Colors.grey.shade200)),
      ),
      padding: EdgeInsets.only(
        left: 8,
        right: 8,
        top: 6,
        bottom: 6 + MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            _buildToolBtn(Icons.format_bold, () => _insertMarkdown('**', '**')),
            _buildToolBtn(Icons.format_italic, () => _insertMarkdown('*', '*')),
            _buildToolBtn(Icons.title, () => _insertMarkdown('### ', '')),
            _buildToolBtn(Icons.code, () => _insertMarkdown('`', '`')),
            _buildToolBtn(Icons.data_object, () => _insertMarkdown('\n```\n', '\n```\n')),
            _buildToolBtn(Icons.format_quote, () => _insertMarkdown('\n> ', '')),
            _buildToolBtn(Icons.format_list_bulleted, () => _insertMarkdown('\n- ', '')),
            _buildToolBtn(Icons.link, () => _insertMarkdown('[链接描述](', ')')),
            _buildToolBtn(Icons.image, () => _insertMarkdown('![图片描述](', ')')),
          ],
        ),
      ),
    );
  }

  Widget _buildToolBtn(IconData icon, VoidCallback onTap) {
    return IconButton(
      icon: Icon(icon, size: 20, color: Colors.grey.shade700),
      onPressed: onTap,
      splashRadius: 20,
      visualDensity: VisualDensity.compact,
    );
  }
}
