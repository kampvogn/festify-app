/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
    pgm.addColumn('users', {
        spotify_refresh_token: { type: 'text', notNull: false },
    });
};

exports.down = (pgm) => {
    pgm.dropColumn('users', 'spotify_refresh_token');
};
