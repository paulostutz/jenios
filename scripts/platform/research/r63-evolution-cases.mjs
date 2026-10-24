import assert from 'node:assert/strict';

export function registerR63EvolutionCases(harness){
  const {check,getPage,getExpect,startServer,origin,route,report}=harness;
  const path=route+'/evolucao';
  const apply=async(scenario='improve')=>{
    const page=getPage(),expect=getExpect();
    await page.getByTestId('evolution-scenario').selectOption(scenario);
    await page.getByTestId('evolution-run').click();
    await expect(page.getByTestId('evolution-report')).toBeVisible();
    await expect(page.getByTestId('evolution-no-orders')).toHaveText('Ordens reais: 0. Paper externo: 0.');
  };
  check('r63_preview_route_scope_and_no_presumed_result','continuous_evolution',async()=>{
    const page=getPage(),expect=getExpect();await page.goto(origin+route,{waitUntil:'networkidle'});
    await page.locator(`a[href="${path}"]`).click();await expect(page).toHaveURL(origin+path);
    await expect(page.getByRole('heading',{name:'Observação e melhoria contínua'})).toBeVisible();
    await expect(page.getByTestId('evolution-empty')).toBeVisible();
    await expect(page.getByTestId('evolution-report')).toHaveCount(0);
    await expect(page.getByTestId('evolution-rollback')).toBeDisabled();
    return {fixtureOnly:true,noPresumedReport:true};
  });
  check('r63_auto_applied_candidate_changes_freshness','continuous_evolution',async()=>{
    const page=getPage(),expect=getExpect();await apply();
    await expect(page.getByTestId('evolution-count-applied')).toHaveText('1');
    await expect(page.getByTestId('evolution-version')).toHaveAttribute('data-max-age','500');
    await expect(page.getByTestId('evolution-before')).toHaveAttribute('data-allow','true');
    await expect(page.getByTestId('evolution-after')).toHaveAttribute('data-allow','false');
    await expect(page.getByTestId('evolution-rollback')).toBeEnabled();
    await expect(page.getByTestId('evolution-maturity')).toContainText('pesquisa sintética');
    return {automaticallyApplied:1,maxAgeMs:500,decisionChanged:true};
  });
  check('r63_rollback_updates_current_version','continuous_evolution',async()=>{
    const page=getPage(),expect=getExpect();await page.getByTestId('evolution-rollback').click();
    await expect(page.getByTestId('evolution-count-rollback')).toHaveText('1');
    await expect(page.getByTestId('evolution-version')).toHaveAttribute('data-max-age','750');
    await expect(page.getByTestId('evolution-after')).toHaveAttribute('data-allow','true');
    await expect(page.getByTestId('evolution-rollback')).toBeDisabled();
    return {restoredMaxAgeMs:750,priorOperationsUndone:false};
  });
  check('r63_edit_invalidates_result','continuous_evolution',async()=>{
    const page=getPage(),expect=getExpect();await page.getByTestId('evolution-scenario').selectOption('regression');
    await expect(page.getByTestId('evolution-report')).toHaveCount(0);
    await expect(page.getByTestId('evolution-comparison')).toHaveCount(0);
    await expect(page.getByTestId('evolution-empty')).toBeVisible();return {previousReportRemoved:true};
  });
  check('r63_regression_is_rejected','continuous_evolution',async()=>{
    const page=getPage(),expect=getExpect();await apply('regression');
    await expect(page.getByTestId('evolution-count-applied')).toHaveText('0');
    await expect(page.getByTestId('evolution-count-rejected')).toHaveText('1');
    await expect(page.getByTestId('evolution-version')).toHaveAttribute('data-max-age','750');
    return {regressionRejected:true};
  });
  for(const scenario of ['insufficient','control_violation'])check(`r63_${scenario}_keeps_baseline`,'continuous_evolution',async()=>{
    const page=getPage(),expect=getExpect();await apply(scenario);
    await expect(page.getByTestId('evolution-count-applied')).toHaveText('0');
    await expect(page.getByTestId('evolution-version')).toHaveAttribute('data-max-age','750');
    await expect(page.getByTestId('evolution-rollback')).toBeDisabled();return {scenario,noPromotion:true};
  });
  check('r63_reload_discards_local_preview','continuous_evolution',async()=>{
    const page=getPage(),expect=getExpect();await page.reload({waitUntil:'networkidle'});
    await expect(page.getByTestId('evolution-report')).toHaveCount(0);await expect(page.getByTestId('evolution-empty')).toBeVisible();
    return {localPreviewDiscarded:true,durableAdminJournalUnaffected:true};
  });
  check('r63_mobile_report_and_disclosure','continuous_evolution',async()=>{
    const page=getPage(),expect=getExpect();await apply();const widths=[];
    await expect(page.getByTestId('evolution-disclosure')).toContainText('exigem transparência');
    await expect(page.getByTestId('evolution-ceiling')).toContainText('Não existe percentual comprovado');
    await expect(page.getByTestId('evolution-schedule')).toContainText('9h');
    for(const width of [375,320]){
      await page.setViewportSize({width,height:920});
      const sizes=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
      assert.ok(Math.max(sizes.document,sizes.body)<=sizes.viewport+1,JSON.stringify(sizes));widths.push(sizes);
    }
    await harness.screenshot('evolution');
    await page.setViewportSize({width:1440,height:1000});return {widths,noPerfectionClaim:true};
  });
  check('r63_admin_http_requires_identity','continuous_evolution_access',async()=>{
    // Server-side loopback read: no credentials, DB call or browser API exemption.
    const response=await fetch(origin+'/api/platform/admin/robot-evolution',{redirect:'manual'});
    assert.equal(response.status,401);const body=await response.json();assert.equal(Object.hasOwn(body,'reports'),false);
    const result={scenario:'r63_admin_without_identity',status:response.status,reportExposed:false};
    (report.serverHttpChecks??=[]).push(result);return result;
  });
  check('r63_disabled_feature_is_404_and_link_absent','continuous_evolution_access',async()=>{
    const page=getPage(),expect=getExpect();await startServer({JENIOS_ROBOT_EVOLUTION_ENABLED:undefined});
    const response=await page.goto(origin+path,{waitUntil:'networkidle'});assert.equal(response.status(),404);
    await page.goto(origin+route,{waitUntil:'networkidle'});await expect(page.locator(`a[href="${path}"]`)).toHaveCount(0);
    const api=await fetch(origin+'/api/platform/admin/robot-evolution',{redirect:'manual'});assert.equal(api.status,404);await api.arrayBuffer();
    await startServer();await page.goto(origin+route,{waitUntil:'networkidle'});
    return {routeStatus:404,apiStatus:404,parentLinkAbsent:true};
  });
}
