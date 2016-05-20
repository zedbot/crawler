function zedBot() {
  throw new Error('Looks like you are expecting the previous "elasticsearch" module. ' +
    'It is now the "es" module. To create a client with this module use ' +
    '`new es.Client(params)`.');
}
zedBot.scraper = require('./scraper');
module.exports = zedBot;
