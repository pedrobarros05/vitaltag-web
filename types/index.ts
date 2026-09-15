// ─── Autenticação ────────────────────────────────────────────────────────────

export interface RegistroRequest {
  nome: string;
  sobrenome: string;
  email: string;
  senha: string;
  consentimento: boolean;
}

export interface LoginRequest {
  email: string;
  senha: string;
}

export interface LoginResponse {
  token: string;
}

// ─── Perfil / Dados Clínicos ─────────────────────────────────────────────────

export interface ContatoEmergencia {
  nome: string;
  telefone: string;
  parentesco: string;
}

export interface Alergia {
  descricao: string;
  gravidade: string;
}

export interface Medicamento {
  nome: string;
  dose: string;
  frequencia: string;
}

export interface Doenca {
  nome: string;
  desde: string; // YYYY-MM-DD ou ""
}

export interface Cirurgia {
  procedimento: string;
  data: string; // YYYY-MM-DD ou ""
}

export interface PerfilRequest {
  nome: string;
  sobrenome: string;
  data_nascimento: string; // YYYY-MM-DD
  tipo_sanguineo: string;
  senha_publica: string;
  contatos_emergencia: ContatoEmergencia[];
  alergias: Alergia[];
  medicamentos: Medicamento[];
  doencas: Doenca[];
  cirurgias: Cirurgia[];
}

export interface PerfilCompleto extends Omit<PerfilRequest, "senha_publica"> {
  slug: string;
  usuario_id: string;
}

// ─── Acesso público ───────────────────────────────────────────────────────────

export interface AcessoPublicoRequest {
  senha: string;
}

export interface ErroResponse {
  erro: string;
}
