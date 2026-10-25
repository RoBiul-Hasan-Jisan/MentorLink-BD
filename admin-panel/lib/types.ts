// Shapes returned by the MentorLink BD API. Rows are loosely typed on purpose: the server owns the schema.
export type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export type Me = { id: string; displayName: string; role: 'student' | 'mentor' | 'employer' | 'department' | 'admin' } & Row;
export type ApiOptions = { method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'; body?: unknown };
