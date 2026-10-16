import json
import time
import hashlib
import urllib.request
import urllib.parse
from pathlib import Path
from datetime import datetime, timezone

BASE = (
    "https://olinda.bcb.gov.br/olinda/servico/"
    "IFDATA/versao/v1/odata"
)

PERIODO = 202606
TIPO = 1
RELATORIO = "5"
CONTA = "79661"

LOTE = 1000
LIMITE_PAGINAS = 200

PASTA = Path(".bankscore-data")
PASTA.mkdir(exist_ok=True)

ARQUIVO = PASTA / f"basileia-{PERIODO}-tipo{TIPO}.json"
TEMPORARIO = PASTA / f"basileia-{PERIODO}-tipo{TIPO}.tmp"

def salvar(dados):
    TEMPORARIO.write_text(
        json.dumps(
            dados,
            ensure_ascii=False,
            indent=2
        ),
        encoding="utf-8"
    )
    TEMPORARIO.replace(ARQUIVO)

def consultar(skip):
    endpoint = (
        f"{BASE}/IfDataValores("
        f"AnoMes={PERIODO},"
        f"TipoInstituicao={TIPO},"
        f"Relatorio='{RELATORIO}')"
    )

    parametros = urllib.parse.urlencode({
        "$format": "json",
        "$top": LOTE,
        "$skip": skip
    })

    req = urllib.request.Request(
        endpoint + "?" + parametros,
        headers={"Accept": "application/json"}
    )

    with urllib.request.urlopen(req, timeout=45) as resposta:
        dados = json.load(resposta)

    if not isinstance(dados.get("value"), list):
        raise ValueError("Resposta IFData inválida")

    return dados["value"]

def assinatura(registros):
    conteudo = json.dumps(
        registros,
        sort_keys=True,
        ensure_ascii=False
    )
    return hashlib.sha256(
        conteudo.encode("utf-8")
    ).hexdigest()

def executar():
    print("\nJENIOS BANKSCORE")
    print("Motor de coleta — Banco Central")
    print("=" * 45, flush=True)

    estado = {
        "fonte": "Banco Central do Brasil - IFData",
        "periodo": PERIODO,
        "tipoInstituicao": TIPO,
        "relatorio": RELATORIO,
        "conta": CONTA,
        "concluido": False,
        "paginas": 0,
        "totalRegistros": 0,
        "indicadores": [],
        "atualizadoEm": None,
        "erro": None
    }

    assinaturas = set()

    for pagina in range(LIMITE_PAGINAS):
        skip = pagina * LOTE

        try:
            registros = consultar(skip)
        except Exception as erro:
            estado["erro"] = str(erro)
            salvar(estado)
            print("Falha na consulta:", erro, flush=True)
            break

        if not registros:
            estado["concluido"] = True
            break

        identificador = assinatura(registros)

        if identificador in assinaturas:
            estado["erro"] = "Página repetida na consulta"
            salvar(estado)
            print("Paginação repetida", flush=True)
            break

        assinaturas.add(identificador)

        encontrados = []

        for item in registros:
            if str(item.get("Conta", "")) != CONTA:
                continue

            encontrados.append({
                "codInst": str(item.get("CodInst", "")),
                "conta": str(item.get("Conta", "")),
                "saldo": item.get("Saldo"),
                "nomeIndicador": item.get("NomeColuna"),
                "periodo": PERIODO,
                "tipoInstituicao": TIPO
            })

        estado["indicadores"].extend(encontrados)
        estado["paginas"] += 1
        estado["totalRegistros"] += len(registros)
        estado["atualizadoEm"] = datetime.now(
            timezone.utc
        ).isoformat()

        if len(registros) < LOTE:
            estado["concluido"] = True

        salvar(estado)

        print(
            f"Página {pagina + 1} | "
            f"Registros: {len(registros)} | "
            f"Basileia: {len(encontrados)}",
            flush=True
        )

        if estado["concluido"]:
            break

        time.sleep(0.3)

    if not estado["concluido"] and not estado["erro"]:
        estado["erro"] = "Limite de páginas atingido"

    salvar(estado)

    print("\nRESULTADO FINAL")
    print("=" * 45)
    print("Coleta completa:", estado["concluido"])
    print("Páginas:", estado["paginas"])
    print("Registros:", estado["totalRegistros"])
    print("Índices encontrados:", len(estado["indicadores"]))
    print("Erro:", estado["erro"] or "Nenhum")
    print("Arquivo:", ARQUIVO)

    if estado["concluido"]:
        print("Coleta encerrada normalmente.")
    else:
        print("Coleta incompleta. Não publicar ranking.")

if __name__ == "__main__":
    executar()
