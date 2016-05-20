var should = require('chai').should(),
    zedbot = require('../index'),
    jsdom = require('jsdom'),
    scraper = zedbot.scraper;
//zedbot.jq = $;

    jsdom.defaultDocumentFeatures = {
      FetchExternalResources   : ['script'], 
      ProcessExternalResources : ['script'],
      MutationEvents           : '2.0',
      QuerySelector            : false
    }    
	
var doc  = jsdom.jsdom("http://google.com/", {
          features: {
            FetchExternalResources   : ['script'],
            ProcessExternalResources : ['script'],
            MutationEvents           : '2.0',
        }
    });
console.log(doc);
var window = doc.defaultView;
jsdom.jQueryify(window, "http://code.jquery.com/jquery-1.5.min.js", function() {
    console.log(window.a);
    console.log(window.$().jquery); //jquery version
});

/*
describe('#scrapeText', function() {
  it('converts & into &amp;', function() {
    var specs = {
      'children': {
        'article': {
          'selector':'.article'
        }
      }
    };
    var html = '<html><head></head><body class="article">Body Text</body></html>';
    var dom = jsdom.jsdom(html,{
      FetchExternalResources   : ['script'], 
      ProcessExternalResources : ['script'],
      MutationEvents           : '2.0',
      QuerySelector            : false
    }    );
    jsdom.getVirtualConsole(dom.defaultView).sendTo(console);
    
    scraper.initHeadless(dom.defaultView, function() {
      console.log(123,scraper.scrape(specs).article);
      scraper.scrapee(specs).article.should.equal('Body Text');
    });    
  });
});
*/