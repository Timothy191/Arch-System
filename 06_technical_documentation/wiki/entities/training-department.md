---
title: Training Department
created: 2026-05-16
updated: 2026-05-17
type: entity
tags: [department]
sources: [raw/articles/arch-systems-project-overview.md]
confidence: high
---

# Training Department

The Training department in Arch-Systems handles the Learning Management System (LMS), certifications, and competency tracking for mining operations personnel.

## Tabs

- dashboard — Training KPI dashboard
- daily-log — Training activity log
- machines — Training equipment and simulators
- history — Historical training records
- reports — Training reports and compliance
- tools — Training tools and resources

## Key Features

- **LMS Integration**: Course management with 8 active courses
- **Certification Tracking**: Competency certifications with expiry dates
- **Competency Matrix**: Skills mapping per role and department
- **Training Records**: Complete history of completed courses and assessments

## Dashboard KPIs

- **Active Courses**: Currently available training programs
- **Compliance Rate**: Percentage of staff with current certifications
- **Pending Assessments**: Evaluations awaiting completion
- **Expiring Certifications**: Certs due for renewal within 30 days

## Database Tables

| Table                    | Purpose                           | Key Columns                                                |
| ------------------------ | --------------------------------- | ---------------------------------------------------------- |
| `training_records`       | Completed courses per employee    | `employee_id`, `course_id`, `completed_at`, `score`        |
| `certifications`         | Active certifications with expiry | `employee_id`, `cert_type`, `issued_at`, `expires_at`      |
| `training_courses`       | Course catalog                    | `name`, `department_id`, `duration_hours`, `required_role` |
| `competency_assessments` | Skills assessments                | `employee_id`, `skill_area`, `assessed_at`, `result`       |
| `machines`               | Training equipment and simulators | `name`, `machine_type`, `serial_number`, `active`          |

Certification expiry queries use `expires_at < NOW() + INTERVAL '30 days'` to surface upcoming renewals.

## Current Completeness Status

| Feature                    | Status  |
| -------------------------- | ------- |
| Dashboard                  | 80%     |
| Forms (daily-log)          | 75%     |
| Tables (machines, history) | 85%     |
| Charts                     | 70%     |
| Real-time updates          | 60%     |
| AI Assistant               | 75%     |
| Mobile responsiveness      | 60%     |
| **Overall**                | **72%** |

**Mobile:** Certification lookup and assessment sign-off are key mobile use cases for trainers working on-site. See [[mobile-pwa]].

## Related

- [[arch-systems]] — parent system
- [[rls-policy]] — security policies protecting training data
- [[design-system]] — UI conventions used in training forms
- [[database-schema]] — certifications and training_records schemas
- [[mobile-pwa]] — mobile responsiveness roadmap
- [[deepeval-integration]] — AI evaluation suite used to assess training content quality
