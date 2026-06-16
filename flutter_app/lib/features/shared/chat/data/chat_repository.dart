// lib/features/shared/chat/data/chat_repository.dart
//
// REST side of chat: conversation list + message history (paginated) + a send fallback for
// when the socket isn't connected. Real-time delivery is the socket's job; this provides
// durable history and offline-cached reads.

import 'package:dio/dio.dart';
import '../../../../core/error/failure_mapper.dart';
import '../../../../core/network/result.dart';
import 'chat_models.dart';

class ChatRepository {
  final Dio _dio;
  ChatRepository(this._dio);

  Future<Result<List<Conversation>>> conversations() async {
    try {
      final res = await _dio.get('/conversations');
      final list = (res.data is Map ? res.data['data'] : res.data) as List? ?? const [];
      return Success(list.whereType<Map<String, dynamic>>().map(Conversation.fromJson).toList());
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }

  Future<Result<List<ChatMessage>>> messages(String conversationId, {required String currentUserId, int page = 1}) async {
    try {
      final res = await _dio.get('/conversations/$conversationId/messages', queryParameters: {'page': page, 'limit': 50});
      final list = (res.data is Map ? res.data['data'] : res.data) as List? ?? const [];
      final messages = list.whereType<Map<String, dynamic>>().map((j) => ChatMessage.fromJson(j, currentUserId: currentUserId)).toList();
      return Success(messages);
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }

  /// REST send fallback (socket is primary). Returns the persisted message.
  Future<Result<ChatMessage>> send(String conversationId, {required String currentUserId, String? body, String? attachmentFileId}) async {
    try {
      final res = await _dio.post('/conversations/$conversationId/messages', data: {
        if (body != null) 'body': body,
        if (attachmentFileId != null) 'attachment_file_id': attachmentFileId,
      });
      final m = res.data is Map ? (res.data['data'] ?? res.data) as Map<String, dynamic> : <String, dynamic>{};
      return Success(ChatMessage.fromJson(m, currentUserId: currentUserId));
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }
}
