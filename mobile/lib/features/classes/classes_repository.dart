import '../../core/session/session_info.dart';
import '../../core/supabase/client.dart';
import '../../shared/models/class_detail.dart';
import '../../shared/models/class_row.dart';

/// Direct RLS-scoped reads, institute-wide (classes/enrollments/users all
/// carry the same institute-wide select policy the rest of the app
/// already relies on — see today_repository.dart's note on this).
/// Ported from src/lib/classes/queries.ts's listClasses/getClass/
/// listEnrolledStudents.
class ClassesRepository {
  Future<List<ClassRow>> fetchClasses(SessionInfo session) async {
    final classes = await supabase
        .from('classes')
        .select(
          'id, subject_id, tutor_id, grade, medium, schedule_days, schedule_start_time, schedule_end_time, fee_amount, group_name',
        )
        .eq('institute_id', session.instituteId)
        .order('created_at', ascending: true);

    final rows = (classes as List).cast<Map<String, dynamic>>();
    if (rows.isEmpty) return [];

    final subjectIds = rows
        .map((c) => c['subject_id'] as String)
        .toSet()
        .toList();
    final tutorIds = rows.map((c) => c['tutor_id'] as String).toSet().toList();
    final classIds = rows.map((c) => c['id'] as String).toList();

    final results = await Future.wait([
      supabase.from('subjects').select('id, name').inFilter('id', subjectIds),
      supabase.from('users').select('id, name').inFilter('id', tutorIds),
      supabase
          .from('enrollments')
          .select('class_id')
          .eq('status', 'active')
          .inFilter('class_id', classIds),
    ]);

    final subjectNameById = {
      for (final s in (results[0] as List).cast<Map<String, dynamic>>())
        s['id'] as String: s['name'] as String,
    };
    final tutorNameById = {
      for (final t in (results[1] as List).cast<Map<String, dynamic>>())
        t['id'] as String: t['name'] as String,
    };
    final studentCountByClass = <String, int>{};
    for (final e in (results[2] as List).cast<Map<String, dynamic>>()) {
      final classId = e['class_id'] as String;
      studentCountByClass[classId] = (studentCountByClass[classId] ?? 0) + 1;
    }

    return rows
        .map(
          (c) => ClassRow(
            id: c['id'] as String,
            subject: subjectNameById[c['subject_id']] ?? 'Unknown',
            groupName: c['group_name'] as String?,
            grade: c['grade'] as String?,
            medium: c['medium'] as String?,
            tutorName: tutorNameById[c['tutor_id']] ?? 'Unknown',
            scheduleDays: (c['schedule_days'] as List).cast<String>(),
            scheduleStartTime: c['schedule_start_time'] as String?,
            scheduleEndTime: c['schedule_end_time'] as String?,
            feeAmount: c['fee_amount'] as num,
            studentCount: studentCountByClass[c['id']] ?? 0,
          ),
        )
        .toList();
  }

  Future<ClassDetail?> fetchClassDetail(
    SessionInfo session,
    String classId,
  ) async {
    final cls = await supabase
        .from('classes')
        .select('*')
        .eq('id', classId)
        .eq('institute_id', session.instituteId)
        .maybeSingle();
    if (cls == null) return null;

    final results = await Future.wait([
      supabase
          .from('subjects')
          .select('id, name')
          .eq('id', cls['subject_id'] as String)
          .maybeSingle(),
      supabase
          .from('users')
          .select('id, name')
          .eq('id', cls['tutor_id'] as String)
          .maybeSingle(),
    ]);
    final subject = results[0];
    final tutor = results[1];

    return ClassDetail(
      id: cls['id'] as String,
      subject: subject?['name'] as String? ?? 'Unknown',
      subjectId: cls['subject_id'] as String,
      groupName: cls['group_name'] as String?,
      grade: cls['grade'] as String?,
      medium: cls['medium'] as String?,
      tutorId: cls['tutor_id'] as String,
      tutorName: tutor?['name'] as String? ?? 'Unknown',
      scheduleDays: (cls['schedule_days'] as List).cast<String>(),
      scheduleStartTime: cls['schedule_start_time'] as String?,
      scheduleEndTime: cls['schedule_end_time'] as String?,
      feeAmount: cls['fee_amount'] as num,
      room: cls['room'] as String?,
      maxStudents: cls['max_students'] as int?,
      tutorPaymentModel: cls['tutor_payment_model'] as String,
      tutorPaymentValue: cls['tutor_payment_value'] as num,
      billingCycleSessions: cls['billing_cycle_sessions'] as int?,
      cycleStartedAt: cls['cycle_started_at'] as String?,
    );
  }

  /// Ported from src/lib/classes/actions.ts's createClass — always
  /// revenue_share (the create form hardcodes this; only edit lets a
  /// class keep whatever payment model it already has). Direct RLS
  /// insert — classes_insert already permits owner/admin_staff
  /// (migration 0001). Skips the web action's generateFeesForClass call:
  /// a brand-new class has zero enrollments, so that call is always a
  /// no-op at creation time (see generateFeesForClass's own early return).
  Future<String> createClass(
    SessionInfo session, {
    required String subjectId,
    required String grade,
    required String medium,
    required String tutorId,
    required List<String> scheduleDays,
    required String scheduleStartTime,
    required String scheduleEndTime,
    String? room,
    String? groupName,
    int? maxStudents,
    required num feeAmount,
    required num tutorPaymentValue,
    int? billingCycleSessions,
    String? cycleStartDate,
  }) async {
    final row = await supabase
        .from('classes')
        .insert({
          'institute_id': session.instituteId,
          'tutor_id': tutorId,
          'subject_id': subjectId,
          'grade': grade,
          'medium': medium,
          'schedule_days': scheduleDays,
          'schedule_start_time': scheduleStartTime,
          'schedule_end_time': scheduleEndTime,
          'room': room,
          'max_students': maxStudents,
          'fee_amount': feeAmount,
          'fee_type': 'monthly_flat',
          'tutor_payment_model': 'revenue_share',
          'tutor_payment_value': tutorPaymentValue,
          'group_name': groupName,
          'billing_cycle_sessions': billingCycleSessions,
          'cycle_started_at': cycleStartDate,
        })
        .select('id')
        .single();
    return row['id'] as String;
  }

  /// Ported from src/lib/classes/actions.ts's updateClass. Direct RLS
  /// update (classes_update, migration 0001) plus, when turning on or
  /// keeping session-cycle billing, the same generateFeesForClass call
  /// the web action makes — unlike at creation time, an existing class
  /// can already have enrolled students, so this one can genuinely
  /// generate real payment rows.
  Future<void> updateClass(
    SessionInfo session, {
    required String classId,
    required String subjectId,
    required String grade,
    required String medium,
    required String tutorId,
    required List<String> scheduleDays,
    required String scheduleStartTime,
    required String scheduleEndTime,
    String? room,
    String? groupName,
    int? maxStudents,
    required num feeAmount,
    required String tutorPaymentModel,
    required num tutorPaymentValue,
    int? billingCycleSessions,
    String? cycleStartDate,
  }) async {
    await supabase
        .from('classes')
        .update({
          'tutor_id': tutorId,
          'subject_id': subjectId,
          'grade': grade,
          'medium': medium,
          'schedule_days': scheduleDays,
          'schedule_start_time': scheduleStartTime,
          'schedule_end_time': scheduleEndTime,
          'room': room,
          'max_students': maxStudents,
          'fee_amount': feeAmount,
          'fee_type': 'monthly_flat',
          'tutor_payment_model': tutorPaymentModel,
          'tutor_payment_value': tutorPaymentValue,
          'group_name': groupName,
          'billing_cycle_sessions': billingCycleSessions,
          'cycle_started_at': cycleStartDate,
        })
        .eq('id', classId)
        .eq('institute_id', session.instituteId);

    if (billingCycleSessions != null && cycleStartDate != null) {
      await _generateFeesForClass(
        session,
        classId,
        '${cycleStartDate.substring(0, 7)}-01',
        cycleStartDate,
      );
    }
  }

  /// Ported from src/lib/fees/generate.ts's generateFeesForClass. Direct
  /// RLS write — payments_insert already permits owner/admin_staff
  /// (migration 0001).
  Future<void> _generateFeesForClass(
    SessionInfo session,
    String classId,
    String month,
    String cycleStartDate,
  ) async {
    final results = await Future.wait<dynamic>([
      supabase
          .from('enrollments')
          .select('student_id')
          .eq('class_id', classId)
          .eq('status', 'active'),
      supabase
          .from('classes')
          .select('institute_id, fee_amount')
          .eq('id', classId)
          .maybeSingle(),
    ]);
    final enrollments = (results[0] as List).cast<Map<String, dynamic>>();
    final cls = results[1] as Map<String, dynamic>?;
    if (enrollments.isEmpty || cls == null) return;

    final rows = enrollments
        .map(
          (e) => {
            'institute_id': cls['institute_id'],
            'student_id': e['student_id'],
            'class_id': classId,
            'month': month,
            'cycle_started_at': cycleStartDate,
            'amount_due': cls['fee_amount'],
            'status': 'pending',
          },
        )
        .toList();

    await supabase
        .from('payments')
        .upsert(
          rows,
          onConflict: 'student_id,class_id,cycle_started_at',
          ignoreDuplicates: true,
        );
  }

  Future<List<EnrolledStudent>> fetchEnrolledStudents(String classId) async {
    final enrollments = await supabase
        .from('enrollments')
        .select('student_id')
        .eq('class_id', classId)
        .eq('status', 'active');
    final studentIds = (enrollments as List)
        .cast<Map<String, dynamic>>()
        .map((e) => e['student_id'] as String)
        .toList();
    if (studentIds.isEmpty) return [];

    final students = await supabase
        .from('users')
        .select('id, name, phone')
        .inFilter('id', studentIds);
    return (students as List)
        .cast<Map<String, dynamic>>()
        .map(
          (s) => EnrolledStudent(
            id: s['id'] as String,
            name: s['name'] as String,
            phone: s['phone'] as String,
            status: 'active',
          ),
        )
        .toList();
  }

  /// Ported from src/lib/institute/queries.ts's getRevenueShareCommissionPercent.
  Future<num> fetchCommissionPercent(SessionInfo session) async {
    final row = await supabase
        .from('institutes')
        .select('revenue_share_commission_percent')
        .eq('id', session.instituteId)
        .single();
    return row['revenue_share_commission_percent'] as num? ?? 25;
  }
}
