// types.d.ts
export interface Record {
    id: number;
    mode: 'study' | 'rest';
    subject?: string;
    duration_ms: number;
    paused_ms?: number;
    segments?: Array<{ type: 'study' | 'pause'; duration_ms: number }>;
    tags?: string[];
    notes?: string;
    created_at: string;
}

export interface Subject {
    id: number;
    name: string;
    sort_order: number;
}

export interface Tag {
    id: number;
    name: string;
    sort_order: number;
}

export interface InsertRecordParams {
    mode: 'study' | 'rest';
    subject?: string;
    duration_ms: number;
    notes?: string;
}

export interface TodayOverview {
    date: string;
    total_study_ms: number;
    total_rest_ms: number;
    total_records: number;
    by_subject: Array<{
        subject: string | null;
        total_ms: number;
        count: number;
    }>;
}