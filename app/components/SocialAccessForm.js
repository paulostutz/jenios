"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

import SocialHandleField from "./SocialHandleField";
import {checkHandleAvailability} from "../../lib/social/handle-policy.mjs";
import {prepareSocialSignup} from "../../lib/social/signup-policy.mjs";
import {socialAuthReturnPath} from "./social-auth-return.mjs";
import "../social/account-controls.css";

export default function SocialAccessForm({ initialRegistration = false, returnTo = '/social' }) {
  const router = useRouter();
  const destination = socialAuthReturnPath(returnTo);
  const submitting = useRef(false);

  const [isCadastro, setIsCadastro] = useState(initialRegistration);
  const [handle, setHandle] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  const campo = {
    padding: "12px",
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    fontSize: "12px",
    backgroundColor: "#f8fafc",
    width: "100%",
    boxSizing: "border-box",
    outlineColor: "#7c3aed",
  };

  const rotulo = {
    fontSize: "11px",
    fontWeight: "bold",
    color: "#334155",
    textTransform: "uppercase",
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting.current) return;

    setErro("");
    setMensagem("");

    if (!supabase) {
      setErro("O acesso está temporariamente indisponível. Tente novamente mais tarde.");
      return;
    }

    submitting.current = true;
    setCarregando(true);

    try {
      if (isCadastro) {
        const signup=prepareSocialSignup({name:nome,email,password:senha,handle});
        const availability=await checkHandleAvailability(signup.options.data.handle);
        if(!availability.available)throw new Error('Este @ não está mais disponível. Escolha outro identificador ou uma sugestão.');
        const { data, error } = await supabase.auth.signUp({
          ...signup,
          options:{...signup.options,emailRedirectTo:`${window.location.origin}/auth/confirm`},
        });

        if (error) {
          const latest=await checkHandleAvailability(handle).catch(()=>null);
          if(latest&&!latest.available)throw new Error('Este @ foi escolhido por outra pessoa. Selecione outro e tente novamente.');
          throw error;
        }

        if (data.session) {
          router.push(destination);
          router.refresh();
        } else {
          setMensagem(
            "Solicitação recebida. Se o cadastro for permitido, verifique seu e-mail para confirmar a conta. Depois, faça login."
          );
          setIsCadastro(false);
          setSenha("");
        }
      } else {
        const { data, error } =
          await supabase.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password: senha,
          });

        if (error) throw error;

        if (!data.session) {
          throw new Error("Não foi possível iniciar a sessão.");
        }

        router.push(destination);
        router.refresh();
      }
    } catch (error) {
      setErro(
        error?.message ||
          "Não foi possível concluir a operação. Tente novamente."
      );
    } finally {
      submitting.current = false;
      setCarregando(false);
    }
  }

  function alternar() {
    if (submitting.current) return;
    setIsCadastro(!isCadastro);
    setErro("");
    setMensagem("");
    setSenha("");
  }

  return (
    <main className="social-account-page"
      style={{
        backgroundColor: "#0f172a",
        color: "#f8fafc",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        fontFamily: "Arial, sans-serif",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: "420px",
          width: "100%",
          backgroundColor: "#ffffff",
          color: "#0f172a",
          borderRadius: "24px",
          padding: "32px",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            borderBottom: "1px solid #e2e8f0",
            paddingBottom: "16px",
          }}
        >
          <div
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "10px",
              backgroundColor: "#7c3aed",
              color: "#fff",
              fontWeight: "900",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            J
          </div>
          <div>
            <span
              style={{
                fontSize: "13px",
                fontWeight: "900",
                letterSpacing: "1px",
                display: "block",
              }}
            >
              JENIOS
            </span>
            <span
              style={{
                fontSize: "10px",
                color: "#7c3aed",
                fontWeight: "bold",
              }}
            >
              {isCadastro ? "ÁREA DE CADASTRO" : "ÁREA DE ACESSO"}
            </span>
          </div>
        </div>

        <div>
          <h1
            style={{
              fontSize: "20px",
              fontWeight: "900",
              margin: 0,
            }}
          >
            {isCadastro ? "Crie a sua conta" : "Bem-vindo de volta"}
          </h1>
          <p
            style={{
              fontSize: "12px",
              color: "#64748b",
              marginTop: "5px",
            }}
          >
            {isCadastro
              ? "Cadastre-se gratuitamente na JENIOS."
              : "Insira seus dados para acessar a plataforma."}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          {isCadastro && (
            <div>
              <label htmlFor="signup-name" style={rotulo}>Nome completo</label>
              <input
                id="signup-name" type="text" maxLength={120} disabled={carregando}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome"
                required
                autoComplete="name"
                style={campo}
              />
            </div>
          )}

          {isCadastro && <SocialHandleField value={handle} onChange={setHandle} disabled={carregando} />}

          <div>
            <label htmlFor="login-email" style={rotulo}>E-mail</label>
            <input
              id="login-email" type="email" disabled={carregando}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              autoComplete="email"
              style={campo}
            />
          </div>

          <div>
            <label htmlFor="login-password" style={rotulo}>Senha</label>
            <input
              id="login-password" type="password" disabled={carregando}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Sua senha"
              minLength={isCadastro ? 12 : undefined}
              required
              autoComplete={
                isCadastro ? "new-password" : "current-password"
              }
              style={campo}
            />
          </div>

          {!isCadastro && <a href="/recuperar-senha" style={{display:"block",textAlign:"right",fontSize:13,color:"#7c3aed",marginBottom:16}}>Esqueci minha senha</a>}

          {isCadastro && (
            <p
              style={{
                fontSize: "11px",
                color: "#6b21a8",
                backgroundColor: "#f3e8ff",
                padding: "12px",
                borderRadius: "8px",
                margin: 0,
              }}
            >
              Sua senha deve ter no mínimo 12 caracteres, com letras maiúsculas e minúsculas, números e símbolos.
              A confirmação por e-mail pode ser necessária.
            </p>
          )}

          {erro && (
            <p
              role="alert"
              style={{
                color: "#b91c1c",
                fontSize: "12px",
                margin: 0,
              }}
            >
              {erro}
            </p>
          )}

          {mensagem && (
            <p
              role="status"
              style={{
                color: "#166534",
                fontSize: "12px",
                margin: 0,
              }}
            >
              {mensagem}
            </p>
          )}

          <button
            type="submit"
            disabled={carregando}
            style={{
              width: "100%",
              backgroundColor: "#7c3aed",
              color: "#fff",
              fontWeight: "bold",
              fontSize: "12px",
              padding: "14px",
              borderRadius: "10px",
              border: "none",
              cursor: carregando ? "wait" : "pointer",
              opacity: carregando ? 0.7 : 1,
            }}
          >
            {carregando
              ? "AGUARDE..."
              : isCadastro
              ? "CRIAR CONTA GRATUITA"
              : "ACESSAR A PLATAFORMA"}
          </button>
        </form>

        <div
          style={{
            textAlign: "center",
            fontSize: "12px",
            color: "#475569",
          }}
        >
          {isCadastro ? "Já tem conta? " : "Não tem cadastro? "}
          <button
            type="button"
            onClick={alternar}
            style={{
              background: "none",
              border: "none",
              color: "#7c3aed",
              fontWeight: "bold",
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            {isCadastro ? "Fazer Login" : "Criar Conta Gratuita"}
          </button>
        </div>

        <div
          style={{
            textAlign: "center",
            borderTop: "1px solid #e2e8f0",
            paddingTop: "14px",
          }}
        >
          <a
            href="/lp"
            style={{
              fontSize: "11px",
              color: "#7c3aed",
              textDecoration: "none",
              fontWeight: "bold",
            }}
          >
            ← Voltar para a Landing Page
          </a>
        </div>
      </div>
    </main>
  );
}
