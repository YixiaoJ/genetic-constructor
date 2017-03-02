var homepageRegister = require('../fixtures/homepage-register');
var newProject = require('../fixtures/newproject');
var openInventoryPanel = require('../fixtures/open-inventory-panel');
var openInspectorPanel = require('../fixtures/open-inspector-panel');
var size = require('../fixtures/size');
var dragFromTo = require('../fixtures/dragfromto.js');

module.exports = {
  'Test order history in inspector panel' : function (browser) {

    size(browser);
    homepageRegister(browser);
    newProject(browser);
    openInventoryPanel(browser, 'Templates');
    browser
      .waitForElementPresent('[data-testid^="inventoryProject/egf_project"] .label-base')
      .click('[data-testid^="inventoryProject/egf_project"] .label-base')
      .waitForElementPresent('[data-testid^="block-"]');

    dragFromTo(browser, '[data-testid^="block-"]', 50, 10, '.inter-construct-drop-target', 50, 4);

    browser
      .click('.construct-viewer .title-and-toolbar [data-id="Order DNA"]')
      .waitForElementPresent('.order-form .page1', 10000, 'expected order dialog to appear')
      .pause(1000)
      .submitForm('.order-form')
      .waitForElementPresent('.order-form .page3', 120000, 'expect summary page to appear')
      // click done
      .click('.order-form button:nth-of-type(1)')
      .waitForElementNotPresent('.order-form', 10000, 'expected order dialog to go away');

    openInspectorPanel(browser, 'Orders');
    browser
      .waitForElementPresent('.InspectorGroupOrders')
      .waitForElementPresent('.InspectorGroupOrders [data-expando="Order 1"]')
      .click('.InspectorGroupOrders [data-expando="Order 1"]')
      .assert.countelements('.InspectorGroupOrders [data-expando="Order 1"] .row', 6)
      .click('.InspectorGroupOrders [data-expando="Order 1"] a')
      .waitForElementPresent('.order-form .page3', 5000, 'expect summary page to appear')
      .end();
  }
};
