-- ==========================================
-- SCRIPT DE CRIAÇÃO DO BANCO (SUPABASE)
-- ==========================================
-- Instruções:
-- 1. Crie sua conta gratuita em supabase.com
-- 2. Crie um novo projeto
-- 3. No menu lateral esquerdo, vá em "SQL Editor"
-- 4. Copie todo este código, cole no editor e aperte "Run"
-- ==========================================

-- Cria a tabela de transações
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    date DATE NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL,
    value NUMERIC(10,2) NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id)
);

-- Ativa a segurança a nível de linha (RLS)
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança (Apenas o próprio usuário pode ver e editar seus dados)
CREATE POLICY "Usuários podem ver suas próprias transações" 
ON public.transactions FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir suas próprias transações" 
ON public.transactions FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias transações" 
ON public.transactions FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem excluir suas próprias transações" 
ON public.transactions FOR DELETE 
USING (auth.uid() = user_id);

-- 🎉 Pronto! Sua tabela está criada e conectada no Supabase!
