# ROBOT-R30 — Regime Adaptive Gate

R30 tests the R28 adaptive break-even gate under changing conditions through time.

Every regime change creates a new authorization epoch. Previous authorization cannot carry over.

Tested transitions include:
- favorable -> cost spike -> recovery -> low fill;
- normal -> bad signal -> signal recovery;
- cheap execution -> adverse conditions -> normalized conditions.

Success criteria:
- immediate revocation when conditions degrade;
- reauthorization only after a fresh favorable regime evaluation;
- no stale authorization carryover;
- zero external execution.
