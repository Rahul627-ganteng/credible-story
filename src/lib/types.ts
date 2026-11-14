export type Category = "Ikhwan" | "Akhwat";
export type MemberStatus = "active" | "warning_sp1" | "confirming_retention" | "terminated";
export type RetentionResponse = "menunggu" | "lanjut" | "siap_dikeluarkan" | null;

export interface Member {
  id: string;
  name: string;
  username: string;
  role: "member" | "admin";
  category: Category | null;
  skills: string[];
  folder_url: string | null;
  status: MemberStatus;
  retention_response: RetentionResponse;
  is_active: boolean;
  must_change_password: boolean;
  terminated_at: string | null;
  created_at: string;
}

export interface RundownPeriod {
  id: string;
  period_month: string;
  label: string | null;
  emoji: string;
  w1_start: string; w1_end: string;
  w2_start: string; w2_end: string;
  w3_start: string; w3_end: string;
  w4_start: string; w4_end: string;
  /** Target story per bulan (Okt 2026 ke belakang: 3; mulai Nov 2026: 4) */
  story_quota: number;
  /** Tenggat tiap story (panjang = story_quota) */
  story_deadlines: string[] | null;
  sks_start: string | null;
  recap_date: string | null;
  monthly_evaluation_notes: string | null;
  evaluation_published_at: string | null;
  is_locked: boolean;
  is_active: boolean;
}

export interface Concept {
  id: string;
  member_id: string;
  period_month: string;
  story_number: number;
  title: string;
  summary: string;
  visual_points: string | null;
  status: "pending" | "revision" | "acc";
  reviewer_feedback: string | null;
  created_at: string;
  updated_at: string;
}

export interface Story {
  id: string;
  member_id: string;
  concept_id: string | null;
  member_name: string | null;
  category: Category | null;
  period_month: string;
  /** null untuk Special Edition */
  story_target: number | null;
  title: string | null;
  submission_mode: "file" | "link";
  file_url: string;
  /** Versi final ber-watermark yang ditampilkan di galeri */
  final_url: string | null;
  final_uploaded_at: string | null;
  special_id: string | null;
  /** Ditandai saat admin mengunduh (satuan/batch) — yang sudah diunduh tidak ikut batch berikutnya */
  downloaded_at: string | null;
  /** Ditandai manual oleh admin, atau otomatis saat versi final diunggah */
  watermarked_at: string | null;
  /** Sidik gambar (dHash 256-bit, hex) untuk mendeteksi story identik/menumpuk */
  image_hash: string | null;
  duplicate_of: string | null;
  dup_ignore: boolean;
  design_app: string | null;
  qc_status: "pending_qc" | "revision" | "acc";
  qc_notes: string | null;
  wa_channel_link: string | null;
  is_published_to_showcase: boolean;
  published_at: string | null;
  is_archive: boolean;
  created_at: string;
  updated_at: string;
}

/** Karya arsip: story lama yang sudah terbit (boleh tanpa akun member / tanpa slot Story 1–3) */
export interface ArchiveItem {
  id: string;
  member_id: string | null;
  member_name: string | null;
  category: Category | null;
  period_month: string;
  title: string | null;
  submission_mode: "file" | "link";
  file_url: string;
  design_app: string | null;
  wa_channel_link: string | null;
  is_published_to_showcase: boolean;
  published_at: string | null;
  is_archive: boolean;
  created_at: string;
  final_url?: string | null;
  image_hash: string | null;
  duplicate_of: string | null;
  dup_ignore: boolean;
}

export interface ShowcaseItem {
  id: string;
  member_name: string;
  category: Category | null;
  period_month: string;
  story_target: number | null;
  title: string | null;
  submission_mode: "file" | "link";
  file_url: string;
  design_app: string | null;
  wa_channel_link: string | null;
  published_at: string | null;
  is_archive: boolean;
  is_special: boolean;
  image_hash: string | null;
}

/** Credible Story Special Edition: 1 story khusus per momen, 1 PIC, dihitung 2 di rekap */
export interface SpecialEdition {
  id: string;
  title: string;
  brief: string | null;
  publish_date: string;
  deadline: string;
  period_month: string;
  pic_member_id: string | null;
  marked_sent: boolean;
  created_at: string;
  updated_at: string;
}

/** Bobot hitungan rekap untuk satu story Special Edition */
export const SPECIAL_WEIGHT = 2;

export interface PeriodFlag {
  member_id: string;
  period_month: string;
  /** Taqdim konsep dilakukan via WhatsApp; admin cukup menandai sudah/belum */
  taqdim_done: boolean;
  taqdim_marked_at: string | null;
  /** Jumlah konsep reguler yang sudah ditaqdimkan (Special Edition PIC otomatis +2 di atasnya) */
  taqdim_count: number;
  has_kabar: boolean;
  excuse_note: string | null;
  design_bareng: boolean;
  last_reminded_at: string | null;
  reminder_count: number;
}

/** Emoji rekap pilihan member untuk satu bulan (terbawa ke bulan berikutnya sampai diganti) */
export interface MemberEmoji { member_id: string; period_month: string; emoji: string; updated_at: string }

export interface MoodItem { title: string; note: string; palette: string[]; pinterest_url: string }

export interface LearningMaterial {
  id: string;
  batch_date: string;
  title: string;
  design_app: string;
  difficulty_level: "Easy" | "Intermediate" | "Advanced";
  summary: string;
  tutorial_markdown: string;
  pinterest_moodboard: MoodItem[];
  challenge_task: string | null;
  sources: { title: string; url: string }[];
  generated_by: string;
  created_at: string;
  youtube_query: string | null;
  videos: YoutubeVideo[];
  videos_checked_at: string | null;
  pins: PinterestPin[];
  pins_checked_at: string | null;
}

export interface PinterestPin { id: string; url: string }

export interface YoutubeVideo { id: string; title: string; channel: string; thumbnail: string }

export interface GenerationRun {
  id: string;
  trigger: string;
  status: "running" | "success" | "skipped" | "error";
  message: string | null;
  materials_created: number;
  started_at: string;
  finished_at: string | null;
}

export interface Application {
  id: string;
  full_name: string;
  category: Category;
  phone_number: string;
  social_media: string | null;
  design_apps: string[];
  skill_level: string | null;
  portfolio_urls: string[];
  sample_paths: string[];
  motivation: string | null;
  status: "pending" | "approved" | "rejected";
  admin_notes: string | null;
  approved_member_id: string | null;
  created_at: string;
}

export interface ArchiveTopic { id: string; title: string; summary: string | null; period_month: string | null; source: string; created_at: string }

export interface Credentials { id: string; username: string; password: string; name: string; phone_number?: string | null }

export const DESIGN_APPS = ["Canva", "Figma", "Photoshop", "Illustrator", "After Effects", "CapCut", "PixelLab", "Alight Motion", "Lainnya"];
