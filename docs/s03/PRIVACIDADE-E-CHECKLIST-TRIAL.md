# S03-B05 — Critérios técnicos e legais do teste gratuito (homologação)

O requisito é **uma concessão de 7 dias por pessoa física**, não por e-mail, @, telefone, aparelho ou conta. A chave deve nascer da identidade **verificada independentemente** por um fornecedor autorizado, vinculada ao usuário autenticado.

A rotina proposta produz HMAC-SHA256 no servidor com segredo de pelo menos 32 bytes, domínio exclusivo `jenios:platform:trial:cpf:v1`. A tabela não contém CPF, nome ou e-mail; o digest é pseudônimo, mas segue sendo dado pessoal e não deve ser tratado como anônimo. Um CPF digitado pelo usuário ou a flag `verified:true` enviada pelo cliente **não são provas de identidade**.

A concessão de crédito temporal é feita por RPC atômica `platform_grant_person_trial_v1`, reservada ao serviço. Dois usuários com o mesmo documento verificado competem pelo mesmo digest único. A segunda tentativa deve receber somente `already_claimed`, sem revelar qual conta detém a concessão. A mesma conta não pode usar documentos diferentes para ampliar o prazo. A duração definida é exatamente 168 horas do timestamp inicial; não há reinício após troca de e-mail, aparelho, @ ou conta.

O ledger em si **não libera assinatura, Pix, cobrança ou operação de mercado**. A integração futura com acesso à Platform requer um serviço de autorização específico que valide horário e identidade, além de piloto jurídico/comercial. Não adicionar cobrança automática no final sem consentimento específico.

**Pré-requisitos obrigatórios:** contrato e API de verificação de identidade, política de privacidade/LGPD, propósito e base legal, retenção e descarte da chave pseudonimizada (incluindo contas excluídas), gestão de contestação e revisão humana, segredo HMAC em cofre de backend, homologação de RLS/RPC em Supabase separado, logs sem documentos pessoais e simulações de concorrência SQL. Nenhum desses pré-requisitos deve ser presumido cumprido pelos testes locais sintéticos.
