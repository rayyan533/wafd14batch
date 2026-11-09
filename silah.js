/**
 * Connected Digital Web Applications Module
 * Handles direct digital web launching for:
 * 1. Darul Falah Campus 360: https://darulfalah.in/campus360/index.php
 * 2. Hostiva Silah Portal: https://hostiva.co.in/silah
 */

const DigitalApps = {
  defaultCampus360Url: 'https://darulfalah.in/campus360/index.php',
  defaultSilahUrl: 'https://hostiva.co.in/silah',

  getCampus360Url() {
    return window.WAFD_SETTINGS?.campus360_url || this.defaultCampus360Url;
  },

  getSilahUrl() {
    return window.WAFD_SETTINGS?.silah_app_url || this.defaultSilahUrl;
  },

  openCampus360() {
    const url = this.getCampus360Url();
    window.open(url, '_blank', 'noopener,noreferrer');
  },

  openSilah() {
    const url = this.getSilahUrl();
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};

// Aliases for compatibility
const SilahApp = {
  openExternal() {
    DigitalApps.openSilah();
  },
  getUrl() {
    return DigitalApps.getSilahUrl();
  }
};

window.DigitalApps = DigitalApps;
window.SilahApp = SilahApp;
