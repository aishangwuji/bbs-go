/// 节点/分类数据模型
///
/// 映射 Go 后端 resp.CategoryResponse
class CategoryModel {
  final int id;
  final String name;
  final String? logo;
  final String? description;

  CategoryModel({
    required this.id,
    required this.name,
    this.logo,
    this.description,
  });

  factory CategoryModel.fromJson(Map<String, dynamic> json) {
    return CategoryModel(
      id: json['id'] is int ? json['id'] as int : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      name: json['name']?.toString() ?? '',
      logo: json['logo']?.toString(),
      description: json['description']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'logo': logo,
      'description': description,
    };
  }
}
