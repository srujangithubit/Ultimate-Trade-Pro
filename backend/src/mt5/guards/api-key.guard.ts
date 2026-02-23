import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { AccountsService } from '../../accounts/accounts.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
    constructor(private accountsService: AccountsService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers['authorization'];

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedException('Missing or invalid API key');
        }

        const rawKey = authHeader.substring(7);
        if (!rawKey || rawKey.length < 10) {
            throw new UnauthorizedException('Invalid API key format');
        }

        const hash = this.accountsService.hashApiKey(rawKey);
        const account = await this.accountsService.findByApiKeyHash(hash);

        if (!account) {
            throw new UnauthorizedException('Invalid API key');
        }

        if (!account.active) {
            throw new UnauthorizedException('Account is disabled');
        }

        // Attach account and user to request for downstream use
        request.tradingAccount = account;
        request.accountUserId = account.user.id;

        return true;
    }
}
