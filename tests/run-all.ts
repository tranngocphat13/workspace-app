import { runSuite, clearRegisteredSuites } from './harness';

async function main() {
  console.log('\n================================================================');
  console.log('   WORKSPACE-APP 4-TIER E2E AUTOMATED TEST SUITE RUNNER');
  console.log('================================================================');

  const overallStart = Date.now();
  const summary: { suite: string; total: number; passed: number; failed: number }[] = [];

  // Tier 1: Feature Coverage
  clearRegisteredSuites();
  await import('./e2e/tier1-feature-coverage.test');
  const tier1Res = await runSuite('Tier 1: Feature Coverage (11 Features)');
  summary.push({ suite: 'Tier 1: Feature Coverage', ...tier1Res });

  // Tier 2: Boundary & Corner Cases
  clearRegisteredSuites();
  await import('./e2e/tier2-boundary-corner.test');
  const tier2Res = await runSuite('Tier 2: Boundary & Corner Cases (11 Features)');
  summary.push({ suite: 'Tier 2: Boundary & Corner Cases', ...tier2Res });

  // Tier 3: Pairwise Combinations
  clearRegisteredSuites();
  await import('./e2e/tier3-pairwise-combinations.test');
  const tier3Res = await runSuite('Tier 3: Pairwise Combinations');
  summary.push({ suite: 'Tier 3: Pairwise Combinations', ...tier3Res });

  // Tier 4: Real-World Application Scenarios
  clearRegisteredSuites();
  await import('./e2e/tier4-application-scenarios.test');
  const tier4Res = await runSuite('Tier 4: Real-World Application Scenarios');
  summary.push({ suite: 'Tier 4: Real-World Application Scenarios', ...tier4Res });

  // Tier 5: Phase 2 CHAT MVP Features
  clearRegisteredSuites();
  await import('./e2e/tier5-phase2-mvp.test');
  const tier5Res = await runSuite('Tier 5: Phase 2 CHAT MVP Features');
  summary.push({ suite: 'Tier 5: Phase 2 CHAT MVP Features', ...tier5Res });

  const totalTests = summary.reduce((acc, s) => acc + s.total, 0);
  const totalPassed = summary.reduce((acc, s) => acc + s.passed, 0);
  const totalFailed = summary.reduce((acc, s) => acc + s.failed, 0);
  const totalDuration = ((Date.now() - overallStart) / 1000).toFixed(2);

  console.log('\n================================================================');
  console.log('                    MASTER TEST RUN SUMMARY');
  console.log('================================================================');
  for (const item of summary) {
    const statusIcon = item.failed === 0 ? '✓ PASS' : '✗ FAIL';
    console.log(
      `  [${statusIcon}] ${item.suite.padEnd(42)}: ${item.passed}/${item.total} passed`
    );
  }
  console.log('----------------------------------------------------------------');
  console.log(
    `Total Tests: ${totalTests} | Passed: ${totalPassed} | Failed: ${totalFailed} | Duration: ${totalDuration}s`
  );
  console.log('================================================================\n');

  if (totalFailed > 0) {
    console.error(`❌ Suite failed with ${totalFailed} failing tests.`);
    process.exit(1);
  } else {
    console.log('✅ All test tiers completed successfully with 100% pass rate.');
    process.exit(0);
  }
}

main().catch((err: unknown) => {
  const errorObj = err instanceof Error ? err : new Error(String(err));
  console.error('Fatal runner error:', errorObj.message);
  process.exit(1);
});
