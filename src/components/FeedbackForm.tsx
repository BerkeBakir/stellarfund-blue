'use client';
import { useI18n } from '@/i18n/I18nProvider';
import { FEEDBACK_FORM_URL } from '@/lib/config';

// Floating button that funnels users to the feedback Google Form.
export default function FeedbackForm() {
  const { locale } = useI18n();
  return (
    <a
      href={FEEDBACK_FORM_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-4 left-4 z-40 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm backdrop-blur hover:bg-white/15"
    >
      💬 {locale === 'tr' ? 'Geri bildirim' : 'Feedback'}
    </a>
  );
}
