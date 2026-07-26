import 'backend_function_client.dart';

class PollService {
  static Future<void> vote({
    required String pollId,
    required String optionId,
  }) async {
    if (pollId.trim().isEmpty || optionId.trim().isEmpty) {
      throw const BackendFunctionException('Choose a valid poll option.');
    }
    await BackendFunctionClient.post('votePoll', {
      'pollId': pollId.trim(),
      'optionId': optionId.trim(),
    });
  }
}
