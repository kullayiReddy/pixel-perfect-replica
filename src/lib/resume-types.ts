export type ResumeEntry = {
  title?: string;
  organization?: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  description?: string;
  highlights?: string[];
  technologies?: string[];
};

export type ParsedResume = {
  full_name?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  summary?: string;
  education?: ResumeEntry[];
  experience?: ResumeEntry[];
  internships?: ResumeEntry[];
  projects?: ResumeEntry[];
  skills?: string[];
  certifications?: string[];
  achievements?: string[];
  languages?: string[];
  confidence?: number;
};

export type AnalysisResult = {
  match_score?: number;
  verdict?: string;
  matching_keywords?: string[];
  missing_keywords?: string[];
  matching_skills?: string[];
  missing_skills?: string[];
  experience_relevance?: { score?: number; comment?: string };
  project_relevance?: { score?: number; comment?: string };
  ats_notes?: string[];
  suggestions?: string[];
};
