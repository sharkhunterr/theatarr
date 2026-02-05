"""CLI commands for Theatarr administration."""

import asyncio
import secrets
import sys
from getpass import getpass

import click
from sqlalchemy import select

from theatarr.database import AsyncSessionLocal, init_db
from theatarr.models import User
from theatarr.services.auth import AuthService


@click.group()
def cli():
    """Theatarr CLI - Administration commands."""
    pass


@cli.command()
@click.option('--username', '-u', prompt=True, help='Username for the new user')
@click.option('--email', '-e', prompt=True, help='Email address')
@click.option('--password', '-p', help='Password (will prompt if not provided)')
@click.option('--admin', is_flag=True, default=False, help='Make user an admin')
def create_user(username: str, email: str, password: str | None, admin: bool):
    """Create a new user account."""
    if not password:
        password = getpass('Password: ')
        confirm = getpass('Confirm password: ')
        if password != confirm:
            click.echo('Error: Passwords do not match', err=True)
            sys.exit(1)

    if len(password) < 8:
        click.echo('Error: Password must be at least 8 characters', err=True)
        sys.exit(1)

    async def _create_user():
        await init_db()
        async with AsyncSessionLocal() as db:
            # Check if user exists
            result = await db.execute(
                select(User).where(
                    (User.username == username) | (User.email == email)
                )
            )
            existing = result.scalar_one_or_none()
            if existing:
                click.echo(f'Error: User with username "{username}" or email "{email}" already exists', err=True)
                sys.exit(1)

            # Create user
            auth_service = AuthService(db)
            user = await auth_service.create_user(
                username=username,
                email=email,
                password=password,
            )

            if admin:
                user.is_admin = True
                await db.commit()

            click.echo(f'User "{username}" created successfully')
            if admin:
                click.echo('  - Admin privileges granted')

    asyncio.run(_create_user())


@cli.command()
@click.option('--username', '-u', prompt=True, help='Username to update')
@click.option('--password', '-p', help='New password (will prompt if not provided)')
def reset_password(username: str, password: str | None):
    """Reset a user's password."""
    if not password:
        password = getpass('New password: ')
        confirm = getpass('Confirm password: ')
        if password != confirm:
            click.echo('Error: Passwords do not match', err=True)
            sys.exit(1)

    if len(password) < 8:
        click.echo('Error: Password must be at least 8 characters', err=True)
        sys.exit(1)

    async def _reset_password():
        await init_db()
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(User).where(User.username == username))
            user = result.scalar_one_or_none()

            if not user:
                click.echo(f'Error: User "{username}" not found', err=True)
                sys.exit(1)

            auth_service = AuthService(db)
            user.password_hash = auth_service._hash_password(password)
            await db.commit()

            click.echo(f'Password reset for user "{username}"')

    asyncio.run(_reset_password())


@cli.command()
def list_users():
    """List all users."""
    async def _list_users():
        await init_db()
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(User))
            users = result.scalars().all()

            if not users:
                click.echo('No users found')
                return

            click.echo(f'{"Username":<20} {"Email":<30} {"Admin":<10} {"Created"}')
            click.echo('-' * 80)
            for user in users:
                admin_status = 'Yes' if getattr(user, 'is_admin', False) else 'No'
                created = user.created_at.strftime('%Y-%m-%d %H:%M')
                click.echo(f'{user.username:<20} {user.email:<30} {admin_status:<10} {created}')

    asyncio.run(_list_users())


@cli.command()
@click.option('--username', '-u', prompt=True, help='Username to delete')
@click.option('--force', '-f', is_flag=True, help='Skip confirmation')
def delete_user(username: str, force: bool):
    """Delete a user account."""
    if not force:
        confirm = click.prompt(f'Are you sure you want to delete user "{username}"? (yes/no)')
        if confirm.lower() != 'yes':
            click.echo('Aborted')
            return

    async def _delete_user():
        await init_db()
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(User).where(User.username == username))
            user = result.scalar_one_or_none()

            if not user:
                click.echo(f'Error: User "{username}" not found', err=True)
                sys.exit(1)

            await db.delete(user)
            await db.commit()

            click.echo(f'User "{username}" deleted')

    asyncio.run(_delete_user())


@cli.command()
def generate_secret():
    """Generate a secure secret key for JWT."""
    secret = secrets.token_urlsafe(32)
    click.echo(f'Generated secret key:')
    click.echo(f'  {secret}')
    click.echo('')
    click.echo('Add this to your .env file:')
    click.echo(f'  JWT_SECRET={secret}')


@cli.command()
def db_init():
    """Initialize the database tables."""
    async def _init():
        await init_db()
        click.echo('Database tables initialized')

    asyncio.run(_init())


@cli.command()
@click.option('--revision', '-r', default='head', help='Revision to upgrade to')
def db_upgrade(revision: str):
    """Run database migrations."""
    from alembic.config import Config
    from alembic import command

    alembic_cfg = Config('alembic.ini')
    command.upgrade(alembic_cfg, revision)
    click.echo(f'Database upgraded to {revision}')


@cli.command()
@click.option('--revision', '-r', default='-1', help='Revision to downgrade to')
def db_downgrade(revision: str):
    """Downgrade database migrations."""
    from alembic.config import Config
    from alembic import command

    alembic_cfg = Config('alembic.ini')
    command.downgrade(alembic_cfg, revision)
    click.echo(f'Database downgraded to {revision}')


@cli.command()
def version():
    """Show Theatarr version."""
    from theatarr import __version__
    click.echo(f'Theatarr v{__version__}')


@cli.command()
def check():
    """Run system health checks."""
    import os

    click.echo('Running system checks...')
    click.echo('')

    # Check environment variables
    required_vars = ['DATABASE_URL', 'JWT_SECRET']
    optional_vars = ['DEBUG', 'TMDB_API_KEY', 'PLEX_URL', 'JELLYFIN_URL']

    click.echo('Environment Variables:')
    for var in required_vars:
        value = os.getenv(var)
        if value:
            masked = value[:4] + '...' if len(value) > 4 else '***'
            click.echo(f'  [OK] {var}: {masked}')
        else:
            click.echo(f'  [ERROR] {var}: Not set (required)', err=True)

    for var in optional_vars:
        value = os.getenv(var)
        if value:
            masked = value[:4] + '...' if len(value) > 4 else '***'
            click.echo(f'  [OK] {var}: {masked}')
        else:
            click.echo(f'  [INFO] {var}: Not set (optional)')

    click.echo('')

    # Check database connection
    async def _check_db():
        try:
            await init_db()
            async with AsyncSessionLocal() as db:
                await db.execute(select(1))
            click.echo('Database Connection:')
            click.echo('  [OK] Database is accessible')
        except Exception as e:
            click.echo('Database Connection:', err=True)
            click.echo(f'  [ERROR] {str(e)}', err=True)

    asyncio.run(_check_db())

    click.echo('')
    click.echo('System check complete')


def main():
    """Entry point for the CLI."""
    cli()


if __name__ == '__main__':
    main()
