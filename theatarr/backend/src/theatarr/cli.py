"""CLI commands for Theatarr administration."""

import asyncio
import secrets
import sys
from getpass import getpass

import click
from sqlalchemy import select

from theatarr.database import async_session_maker, init_db
from theatarr.models.user import User
from theatarr.services.auth import hash_password


@click.group()
def cli():
    """Theatarr CLI - Administration commands."""
    pass


@cli.command()
@click.option('--username', '-u', prompt=True, help='Username for the new user')
@click.option('--password', '-p', help='Password (will prompt if not provided)')
def create_user(username: str, password: str | None):
    """Create a new user account."""
    if not password:
        password = getpass('Password: ')
        confirm = getpass('Confirm password: ')
        if password != confirm:
            click.echo('Error: Passwords do not match', err=True)
            sys.exit(1)

    if len(password) < 6:
        click.echo('Error: Password must be at least 6 characters', err=True)
        sys.exit(1)

    async def _create_user():
        async with async_session_maker() as db:
            # Check if user exists
            result = await db.execute(
                select(User).where(User.username == username)
            )
            existing = result.scalar_one_or_none()
            if existing:
                click.echo(f'Error: User "{username}" already exists', err=True)
                sys.exit(1)

            # Create user
            user = User(
                username=username,
                password_hash=hash_password(password),
                is_active=True,
            )
            db.add(user)
            await db.commit()

            click.echo(f'User "{username}" created successfully')

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

    if len(password) < 6:
        click.echo('Error: Password must be at least 6 characters', err=True)
        sys.exit(1)

    async def _reset_password():
        async with async_session_maker() as db:
            result = await db.execute(select(User).where(User.username == username))
            user = result.scalar_one_or_none()

            if not user:
                click.echo(f'Error: User "{username}" not found', err=True)
                sys.exit(1)

            user.password_hash = hash_password(password)
            await db.commit()

            click.echo(f'Password reset for user "{username}"')

    asyncio.run(_reset_password())


@cli.command()
def list_users():
    """List all users."""
    async def _list_users():
        await init_db()
        async with async_session_maker() as db:
            result = await db.execute(select(User))
            users = result.scalars().all()

            if not users:
                click.echo('No users found')
                return

            click.echo(f'{"Username":<20} {"Active":<10} {"Created"}')
            click.echo('-' * 50)
            for user in users:
                active_status = 'Yes' if user.is_active else 'No'
                created = user.created_at.strftime('%Y-%m-%d %H:%M')
                click.echo(f'{user.username:<20} {active_status:<10} {created}')

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
        async with async_session_maker() as db:
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
            async with async_session_maker() as db:
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
