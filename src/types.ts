export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  value: number;
  category: string;
  description: string;
  date: string; // ISO string
  created_at: string; // ISO string
}

export interface Profile {
  id: string;
  name: string;
  email: string;
  created_at: string;
  salary_user?: number;
  salary_spouse?: number;
}

export interface FixedExpense {
  id: string;
  user_id: string;
  name: string;
  value: number;
  category: string;
  created_at: string;
}

export interface Budget {
  id: string;
  user_id: string;
  category: string;
  limit_value: number;
  created_at: string;
}

export const CATEGORIES = [
  'Alimentação',
  'Transporte',
  'Moradia',
  'Lazer',
  'Dízimos/Ofertas',
  'Saúde',
  'Educação',
  'Salários',
  'Dinheiro extra',
  'Outros'
];

export const CHRISTIAN_QUOTES = [
  "Sua fé guiando suas finanças",
  "Seja fiel no pouco para conquistar o muito",
  "Organização hoje, provisão amanhã",
  "Honra ao Senhor com os teus bens e com as primícias de toda a tua renda.",
  "Seja fiel no pouco para governar o muito.",
  "O Senhor é o meu pastor, nada me faltará.",
  "Buscai primeiro o Reino de Deus e a sua justiça, e todas estas coisas vos serão acrescentadas.",
  "Tudo o que fizerem, façam de todo o coração, como para o Senhor.",
  "A bênção do Senhor traz riqueza e não inclui dor alguma."
];
