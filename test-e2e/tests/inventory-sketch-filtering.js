var homepageRegister = require('../fixtures/homepage-register');
var size = require('../fixtures/size');
var openInventory = require('../fixtures/open-inventory');

module.exports = {
  'Verify we can filter sketch blocks in the inventory': function (browser) {
    size(browser);
    homepageRegister(browser);
    openInventory(browser);
    browser
      .waitForElementPresent('.InventorySectionIcon[data-section="Sketch"]', 5000, 'expected a section icon')
      .click('.InventorySectionIcon[data-section="Sketch"]')
      .pause(3000)
      // start with 14 sketch blocks
      .assert.countelements('.InventoryItem-item', 14)
      // filter with 'pro' which should produce 3 [promoter, protease, protein stability]
      .clearValue('.InventorySearch-input')
      .setValue('.InventorySearch-input', 'pro')
      .pause(3000)
      .assert.countelements('.InventoryItem-item', 3)
      .end();
  }
};