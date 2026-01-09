# NestJS Guards Examples

Practical examples for creating authentication and authorization guards for NestJS using the AI Fabrix Miso Client SDK.

**You need to:** Create authentication and authorization guards for NestJS.

**Here's how:** Implement guards that validate tokens and check roles/permissions.

## Authentication Guard

```typescript
// auth.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

@Injectable()
export class AuthGuard implements CanActivate {
  private client: MisoClient;

  constructor() {
    // ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
    this.client = new MisoClient(loadConfig());
    this.client.initialize();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const isValid = await this.client.validateToken(token);
      if (!isValid) {
        throw new UnauthorizedException('Invalid token');
      }

      const user = await this.client.getUser(token);
      request.user = user;
      return true;
    } catch (error) {
      await this.client.log.error('Authentication failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        path: request.url
      });
      throw new UnauthorizedException('Authentication failed');
    }
  }
}
```

## Role Guard

```typescript
// role.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

@Injectable()
export class RoleGuard implements CanActivate {
  private client: MisoClient;

  constructor(private reflector: Reflector) {
    this.client = new MisoClient(loadConfig());
    this.client.initialize();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new ForbiddenException('No token provided');
    }

    try {
      const hasAnyRole = await this.client.hasAnyRole(token, requiredRoles);
      if (!hasAnyRole) {
        await this.client.log
          .withRequest(request)
          .audit('access.denied', 'authorization', {
            requiredRoles
          });
        throw new ForbiddenException('Insufficient permissions');
      }

      return true;
    } catch (error) {
      await this.client.log.error('Role check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requiredRoles,
        userId: request.user?.id
      });
      throw new ForbiddenException('Role check failed');
    }
  }
}

// Usage in Controller
@Controller('posts')
@UseGuards(AuthGuard)
export class PostsController {
  @Post()
  @UseGuards(RoleGuard)
  @SetMetadata('roles', ['admin', 'editor'])
  async create(@Request() req, @Body() createPostDto: CreatePostDto) {
    await this.client.log
      .withRequest(req)
      .audit('post.created', 'posts', {
        postTitle: createPostDto.title
      });
    return this.postsService.create(createPostDto);
  }
}
```

**See Also:**

- [Authentication Reference](../reference-authentication.md) - Complete authentication API reference
- [Authorization Reference](../reference-authorization.md) - Role and permission management
