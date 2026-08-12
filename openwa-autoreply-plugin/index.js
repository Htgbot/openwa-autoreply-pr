/**
 * OpenWA Auto-Reply Workflow Plugin Entry Point
 */
class AutoReplyWorkflowsPlugin {
  constructor(api) {
    this.api = api;
  }

  async onEnable() {
    if (this.api?.logger) {
      this.api.logger.info('[AutoReply Workflows Plugin] Loaded successfully');
    }
  }

  async onDisable() {}
}

module.exports = AutoReplyWorkflowsPlugin;
