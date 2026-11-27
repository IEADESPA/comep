-- =====================================================================
-- FASE 5.5 — A REGRA 1 DA REGULARIZAÇÃO, COMO O PRESIDENTE DECIDIU (26/11/2026; leitura confirmada em 27/11/2026)
--
-- "O documento que falta tem 30 dias, contados da ativação": nesses dias a igreja NÃO fica suspensa. Ela fica na
-- pendência com prazo, que o sistema já usava (regular, com "falta … (até dd/mm/aaaa)"), e o pastor presidente
-- trabalha normalmente. Só passado o prazo sem o documento a igreja fica suspensa, e aí valem os 30 dias de sempre
-- para mandar, antes do bloqueio do perfil (como o documento que vence). A 20261126150000 deixava a igreja suspensa
-- desde a ativação.
--
-- Muda só o que nunca veio (a linha do "nunca veio" na conta do primeiro dia sem o documento). O que venceu continua
-- como antes, porque a decisão separa os dois ("o alvará vencido também tem 30 dias"), como o sistema já separava: a
-- igreja fica suspensa no dia seguinte ao vencimento, ou desde a ativação, se o documento já tinha vencido antes dela,
-- com os 30 dias para mandar (e a tolerância de janeiro do alvará).
--
-- A situação passa a dizer em `nunca_vieram` também o que nunca veio e ainda está no prazo (para as telas dizerem
-- "mande até", e não "venceu"). O resto da função é o da 20261126150000; as outras funções (o efeito das regras, os
-- avisos, a credencial) chamam esta e acompanham sozinhas.
-- =====================================================================

-- Devolve:
--   situacao: regular | suspensa | sem_registro | em_analise
--   vencidos: o que suspendeu (estatuto, cartao_cnpj, natureza_juridica, ata_diretoria, alvara); nunca_vieram: o que
--   nunca veio, suspenso ou ainda no prazo; pendencias: o que falta e ainda está no prazo, sem suspender (pendencias_ate;
--   null quando o novo já chegou e espera a conferência); suspensa_desde; prazo_ate (o último dia para mandar, contando
--   os dias depois da recusa fora do prazo); perfil_bloqueado; alvara_ate e mandato_ate (já contando o documento
--   antecipado); natureza_prazo (associação privada); proximo_vencimento; ativada_em; e, na igreja sem registro,
--   readequacao_ate.
create or replace function interno.situacao_igreja_com(p_igreja_id uuid, p_dia date, p_cfg public.config_igrejas)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_igreja public.igrejas;
  v_ativada date;
  v_item text;
  v_cob date;
  v_desde date;
  v_tolerancia date;
  v_suspensa date;
  v_vencidos text[] := '{}';
  v_nunca text[] := '{}';
  v_pendencias text[] := '{}';
  v_pendencias_ate date;
  v_sem_envio text[] := '{}';
  v_proximo date;
  v_alvara date;
  v_mandato date;
  v_natureza_prazo date;
  v_prazo date;
  v_recusa date;
  v_prazo_item date;
  v_prazo_efetivo date;
  v_bloqueado boolean := false;
begin
  select * into v_igreja from public.igrejas where id = p_igreja_id;
  if not found then
    return null;
  end if;
  -- nada conta antes da ativação (no dado antigo sem ela, o dia do cadastro)
  v_ativada := coalesce(v_igreja.ativada_em, v_igreja.criado_em::date);
  if v_igreja.cadastro = 'sem_registro' then
    return jsonb_build_object('situacao', 'sem_registro', 'perfil_bloqueado', true,
                              'vencidos', '[]'::jsonb, 'pendencias', '[]'::jsonb,
                              'ativada_em', v_ativada, 'readequacao_ate', v_ativada + p_cfg.dias_readequacao);
  end if;
  if v_igreja.cadastro <> 'completo' then
    return jsonb_build_object('situacao', v_igreja.cadastro, 'perfil_bloqueado', true,
                              'vencidos', '[]'::jsonb, 'pendencias', '[]'::jsonb);
  end if;
  if v_igreja.natureza_juridica = 'associacao_privada' then
    v_natureza_prazo := greatest(coalesce(v_igreja.natureza_desde, v_ativada), v_ativada) + p_cfg.dias_natureza;
  end if;

  foreach v_item in array array['estatuto', 'cartao_cnpj', 'natureza_juridica', 'ata_diretoria', 'alvara'] loop
    if v_item = 'natureza_juridica' then
      v_cob := case v_igreja.natureza_juridica
                 when 'organizacao_religiosa' then 'infinity'::date
                 when 'associacao_privada' then v_natureza_prazo
               end;
    else
      v_cob := interno.cobertura_documento(p_igreja_id, v_item::public.tipo_documento_igreja, p_dia);
    end if;
    if v_cob is not null and v_cob >= p_dia then
      if v_cob < 'infinity'::date then
        v_proximo := least(v_proximo, v_cob);
        if v_item = 'alvara' then
          v_alvara := v_cob;
        elsif v_item = 'ata_diretoria' then
          v_mandato := v_cob;
        end if;
      end if;
      continue;
    end if;

    -- venceu (ou nunca veio): o primeiro dia sem o documento, nunca antes da ativação
    v_tolerancia := null;
    if v_cob is null then
      -- nunca veio: os dias para mandar contam da ativação, sem suspender (a regra 1, confirmada em 27/11/2026)
      v_desde := v_ativada + p_cfg.dias_para_mandar;
    else
      v_desde := v_cob + 1;
      -- o alvará que vence em 31/12: a tolerância de janeiro
      if v_item = 'alvara' and to_char(v_cob, 'MM-DD') = '12-31' and p_cfg.dias_tolerancia_alvara > 0 then
        v_tolerancia := v_cob + p_cfg.dias_tolerancia_alvara;
        v_desde := v_tolerancia + 1;
      end if;
    end if;
    v_desde := greatest(v_desde, v_ativada);

    if v_cob is null then
      v_nunca := v_nunca || v_item;
    end if;
    if v_desde > p_dia then
      -- ainda no prazo: falta, sem suspender
      v_pendencias := v_pendencias || v_item;
      v_pendencias_ate := least(v_pendencias_ate, v_desde - 1);
      v_proximo := least(v_proximo, v_desde - 1);
    elsif v_tolerancia is not null and exists (
      select 1 from public.igreja_documentos d
      where d.igreja_id = p_igreja_id and d.tipo = 'alvara' and d.situacao = 'pendente' and d.arquivado_em is null
        and d.criado_em::date <= v_tolerancia
    ) then
      -- o alvará novo chegou dentro da tolerância e espera a conferência: não suspende
      v_pendencias := v_pendencias || v_item;
    else
      v_suspensa := least(v_suspensa, v_desde);
      v_vencidos := v_vencidos || v_item;
      -- mandou o documento novo (esperando a conferência)? então o perfil não é bloqueado
      if not exists (
        select 1 from public.igreja_documentos d
        where d.igreja_id = p_igreja_id and d.situacao = 'pendente' and d.arquivado_em is null
          and (d.tipo::text = v_item
               or (v_item = 'natureza_juridica' and (d.tipo = 'cartao_cnpj' or (d.tipo = 'ata_diretoria' and d.muda_natureza))))
      ) then
        v_sem_envio := v_sem_envio || v_item;
      end if;
    end if;
  end loop;

  if v_suspensa is not null then
    v_prazo := v_suspensa + p_cfg.dias_para_mandar - 1;
    -- cada item sem o documento novo: o prazo da igreja, ou, se o pastor mandou dentro dele e a secretaria só recusou
    -- depois, os dias depois da recusa
    foreach v_item in array v_sem_envio loop
      select max(d.conferido_em::date) into v_recusa
      from public.igreja_documentos d
      where d.igreja_id = p_igreja_id and d.situacao = 'recusado' and d.arquivado_em is null
        and (d.tipo::text = v_item
             or (v_item = 'natureza_juridica' and (d.tipo = 'cartao_cnpj' or (d.tipo = 'ata_diretoria' and d.muda_natureza))))
        and d.criado_em::date <= v_prazo
        and d.conferido_em::date > v_prazo;
      v_prazo_item := greatest(v_prazo, v_recusa + p_cfg.dias_apos_recusa - 1);
      v_prazo_efetivo := least(v_prazo_efetivo, v_prazo_item);
      if p_dia > v_prazo_item then
        v_bloqueado := true;
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'situacao', case when v_suspensa is null then 'regular' else 'suspensa' end,
    'vencidos', to_jsonb(v_vencidos),
    'nunca_vieram', to_jsonb(v_nunca),
    'pendencias', to_jsonb(v_pendencias),
    'pendencias_ate', v_pendencias_ate,
    'suspensa_desde', v_suspensa,
    'prazo_ate', coalesce(v_prazo_efetivo, v_prazo),
    'perfil_bloqueado', v_bloqueado,
    'alvara_ate', v_alvara,
    'mandato_ate', v_mandato,
    'natureza_prazo', v_natureza_prazo,
    'proximo_vencimento', v_proximo,
    'ativada_em', v_ativada
  );
end;
$$;

-- Só as outras funções do banco chamam esta (como dono)
revoke all on function interno.situacao_igreja_com(uuid, date, public.config_igrejas) from public;
