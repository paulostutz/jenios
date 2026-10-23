# B305-R17 — Auth, segurança e onboarding por e-mail

Base consultada antes da alteração:
- R16 certificado: `97de6e08d847e5ff16bf6c5f2c215a8f6a521f24`;
- CI R16: `39878455821` SUCCESS;
- artefato R16: `12469542272`, digest `sha256:966354a1754483df3d22769a296a10456abb56aa855bec3a1d01df92962f283a`;
- Supabase QA: `jenios-social-homologacao`;
- produção não alterada.

Entregas R17:
1. identidade visual JENIOS para reset de senha, troca de e-mail, reautenticação e notificações de segurança;
2. templates de identidade vinculada/removida e MFA adicionada/removida;
3. templates de onboarding iniciado/concluído adicionados à camada de lifecycle;
4. onboarding **não é enfileirado automaticamente**, pois a tela atual ainda não persiste conclusão em estado durável;
5. testes impedem ausência das variáveis Go Template obrigatórias e vazamento de marcadores internos.

Gates de envio financeiro/transacional permanecem inalterados e desligados.
