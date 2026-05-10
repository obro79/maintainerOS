import type {
  DashboardViewModel,
  EvaluationSummaryViewModel,
  ClustlyBountyListItemViewModel,
  IssueDetailViewModel,
  IssueTraceEventViewModel,
  MaintainerOSRepository,
  SandboxAttemptListItemViewModel,
  VerificationQueueItemViewModel,
} from './types';
import { FixtureMaintainerOSRepository } from './fixture-repository';
import { NeonMaintainerOSRepository } from './neon-repository';
import { hasNeonConnection } from './postgres';
import { isOfflineMode } from './provider-runtime';

export function getMaintainerOSRepository(): MaintainerOSRepository {
  if (isOfflineMode()) {
    return new FixtureMaintainerOSRepository({
      dataMode: 'fixture',
      sourceState: 'fixture',
      fallbackReason: 'MAINTAINEROS_OFFLINE_MODE is enabled; live provider reads are disabled.',
    });
  }

  const mode = process.env.MAINTAINEROS_DATA_MODE ?? 'fixture';

  if (mode === 'live') {
    if (!hasNeonConnection()) {
      return new FixtureMaintainerOSRepository({
        dataMode: 'fixture',
        sourceState: 'fixture',
        fallbackReason: 'MAINTAINEROS_DATA_MODE=live but NEON_DATABASE_URL/DATABASE_URL is not configured.',
      });
    }
    return new FallbackMaintainerOSRepository(new NeonMaintainerOSRepository(), 'live Neon read failed.');
  }

  if (mode === 'rehearsal') {
    return new FixtureMaintainerOSRepository({ dataMode: 'rehearsal', sourceState: 'rehearsal' });
  }

  return new FixtureMaintainerOSRepository();
}

class FallbackMaintainerOSRepository implements MaintainerOSRepository {
  private readonly timeoutMs = getLiveTimeoutMs();

  constructor(
    private readonly primary: MaintainerOSRepository,
    private readonly fallbackPrefix: string,
  ) {}

  async getDashboard(repositoryId?: string): Promise<DashboardViewModel> {
    try {
      return await this.tryPrimary(() => this.primary.getDashboard(repositoryId));
    } catch (error) {
      return this.fixture(error).getDashboard(repositoryId);
    }
  }

  async getIssueDetail(repositoryId: string, issueNumber: number): Promise<IssueDetailViewModel | null> {
    try {
      return await this.tryPrimary(() => this.primary.getIssueDetail(repositoryId, issueNumber));
    } catch (error) {
      return this.fixture(error).getIssueDetail(repositoryId, issueNumber);
    }
  }

  async getIssueTrace(repositoryId: string, issueNumber: number): Promise<IssueTraceEventViewModel[]> {
    try {
      return await this.tryPrimary(() => this.primary.getIssueTrace(repositoryId, issueNumber));
    } catch (error) {
      return this.fixture(error).getIssueTrace(repositoryId, issueNumber);
    }
  }

  async getEvaluationSummary(repositoryId?: string): Promise<EvaluationSummaryViewModel> {
    try {
      return await this.tryPrimary(() => this.primary.getEvaluationSummary(repositoryId));
    } catch (error) {
      return this.fixture(error).getEvaluationSummary();
    }
  }

  async getSandboxAttempts(repositoryId?: string): Promise<SandboxAttemptListItemViewModel[]> {
    try {
      return await this.tryPrimary(() => this.primary.getSandboxAttempts(repositoryId));
    } catch (error) {
      return this.fixture(error).getSandboxAttempts(repositoryId);
    }
  }

  async getVerificationQueue(repositoryId?: string): Promise<VerificationQueueItemViewModel[]> {
    try {
      return await this.tryPrimary(() => this.primary.getVerificationQueue(repositoryId));
    } catch (error) {
      return this.fixture(error).getVerificationQueue(repositoryId);
    }
  }

  async getBountyTasks(repositoryId?: string): Promise<ClustlyBountyListItemViewModel[]> {
    try {
      return await this.tryPrimary(() => this.primary.getBountyTasks(repositoryId));
    } catch (error) {
      return this.fixture(error).getBountyTasks(repositoryId);
    }
  }

  private tryPrimary<T>(operation: () => Promise<T>): Promise<T> {
    return withTimeout(operation(), this.timeoutMs);
  }

  private fixture(error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown live repository failure.';
    return new FixtureMaintainerOSRepository({
      dataMode: 'fixture',
      sourceState: 'fixture',
      fallbackReason: `${this.fallbackPrefix} ${message}`,
    });
  }
}

function getLiveTimeoutMs() {
  const minimumLiveTimeoutMs = 8000;
  const parsed = Number(process.env.MAINTAINEROS_LIVE_TIMEOUT_MS);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.max(parsed, minimumLiveTimeoutMs);
  }
  return minimumLiveTimeoutMs;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`Live data read timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}
