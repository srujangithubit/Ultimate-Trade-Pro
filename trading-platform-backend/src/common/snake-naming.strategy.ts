import { DefaultNamingStrategy, NamingStrategyInterface } from 'typeorm';

/**
 * Converts camelCase entity property names to snake_case database column names.
 * This ensures TypeORM entities with camelCase fields map correctly to
 * the existing PostgreSQL schema which uses snake_case columns.
 */
export class SnakeNamingStrategy
    extends DefaultNamingStrategy
    implements NamingStrategyInterface {
    columnName(
        propertyName: string,
        customName: string | undefined,
        embeddedPrefixes: string[],
    ): string {
        const name = customName || this.toSnakeCase(propertyName);
        return embeddedPrefixes.length
            ? this.toSnakeCase(embeddedPrefixes.join('_')) + name
            : name;
    }

    tableName(targetName: string, userSpecifiedName?: string): string {
        return userSpecifiedName || this.toSnakeCase(targetName);
    }

    relationName(propertyName: string): string {
        return this.toSnakeCase(propertyName);
    }

    joinColumnName(
        relationName: string,
        referencedColumnName: string,
    ): string {
        return this.toSnakeCase(relationName) + '_' + referencedColumnName;
    }

    joinTableName(
        firstTableName: string,
        secondTableName: string,
        firstPropertyName: string,
    ): string {
        return (
            this.toSnakeCase(firstTableName) +
            '_' +
            this.toSnakeCase(firstPropertyName) +
            '_' +
            this.toSnakeCase(secondTableName)
        );
    }

    joinTableColumnName(
        tableName: string,
        propertyName: string,
        columnName?: string,
    ): string {
        return (
            this.toSnakeCase(tableName) + '_' + (columnName || this.toSnakeCase(propertyName))
        );
    }

    private toSnakeCase(str: string): string {
        return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
    }
}
