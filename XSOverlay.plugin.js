/**
 * @name XSOverlay
 * @source https://github.com/Eidenz/XSOverlay-BetterDiscord/blob/main/XSOverlay.plugin.js
 * @updateUrl https://raw.githubusercontent.com/Eidenz/XSOverlay-BetterDiscord/main/XSOverlay.plugin.js
 * @version 1.1
*/
const request = require("request");
const fs = require("fs");
const path = require("path");
const dgram = require("dgram");

const config = {
    info: {
        name: "XSOverlay",
        authors: [
            {
                name: "Eidenz",
                discord_id: "190818738096963584",
                github_username: "Eidenz"
            }
        ],
        version: "1.1",
        updateUrl: "https://raw.githubusercontent.com/Eidenz/XSOverlay-BetterDiscord/main/XSOverlay.plugin.js",
        description:
          "Get your discord notifications in VR through XSOverlay!",
      },
    changelog: [
      {
        title: "Feature",
        items: ["Added a setting menu to tweak notifications"]
      }
    ]
  };

module.exports = !global.ZeresPluginLibrary
  ? class {
      constructor() {
        this._config = config;
      }

      load() {
        BdApi.showConfirmationModal(
          "Library plugin is needed",
          `The library plugin needed for this plugin is missing. Please click Download Now to install it.`,
          {
            confirmText: "Download",
            cancelText: "Cancel",
            onConfirm: () => {
              request.get(
                "https://rauenzi.github.io/BDPluginLibrary/release/0PluginLibrary.plugin.js",
                (error, response, body) => {
                  if (error)
                    return electron.shell.openExternal(
                      "https://betterdiscord.net/ghdl?url=https://raw.githubusercontent.com/rauenzi/BDPluginLibrary/master/release/0PluginLibrary.plugin.js"
                    );

                  fs.writeFileSync(
                    path.join(BdApi.Plugins.folder, "0PluginLibrary.plugin.js"),
                    body
                  );
                }
              );
            },
          }
        );
      }

      start() {}

      stop() {}
    }
  : (([Plugin, Library]) => {
      const {
        DiscordModules,
        WebpackModules,
        Patcher,
      } = Library;
      const {
        Dispatcher,
        UserStore,
        ChannelStore,
        GuildStore,
      } = DiscordModules;
      const ChannelTypes =
        WebpackModules.getByProps("ChannelTypes").ChannelTypes;
      const MuteStore = WebpackModules.getByProps("isSuppressEveryoneEnabled");
      const isMentioned = WebpackModules.getByProps("isRawMessageMentioned");

      function calculateHeight (content) {
        if (content.length <= 100) {
          return 100;
        } else if (content.length <= 200) {
          return 150;
        } else if (content.length <= 300) {
          return 200;
        }
        return 250;
      }

      function sendToXSOverlay (data) {
        const server = dgram.createSocket('udp4');
        server.send(data, 42069, '127.0.0.1', () => {
          server.close();
        });
      }

      function clearMessage(content) {
        while(content.includes("<@")){
          let toreplace = content.substring(content.indexOf("<@"));
          toreplace = toreplace.substring(0, toreplace.indexOf(">")+1);
          content = content.replace(toreplace, "[@user]");
        }
        while(content.includes("<&")){
          let toreplace = content.substring(content.indexOf("<&"));
          toreplace = toreplace.substring(0, toreplace.indexOf(">")+1);
          content = content.replace(toreplace, "[@role]");
        }
        return content.replace(new RegExp('<[^>]*>', 'g'), '');
      }

      class plugin extends Plugin {
        constructor() {
          super();

          const om = this.onMessage.bind(this);
          this.onMessage = (e) => {
            try {
              om(e);
            } catch (e) {
              //error
            }
          };
          const friendRequestFunc = this.friendRequest.bind(this);
          this.friendRequest = (e) => {
            try {
              friendRequestFunc(e);
            } catch (e) {
              //error
            }
          };
        }

        load() {
          try {
            global.ZeresPluginLibrary.PluginUpdater.checkForUpdate(config.info.name, config.info.version, config.info.updateUrl);
          }
          catch (err) {
            console.error(this.getName(), "Plugin Updater could not be reached.", err);
          }
        }

        onStart() {
          this.xsoverlayenabled = BdApi.loadData(config.info.name, "xsoverlayenabled") ?? true;
          this.xsoverlaydm = BdApi.loadData(config.info.name, "xsoverlaydm") ?? true;
          this.xsoverlayserver = BdApi.loadData(config.info.name, "xsoverlayserver") ?? true;
          this.SwitchItem = BdApi.findModuleByDisplayName("SwitchItem");
          Dispatcher.subscribe("MESSAGE_CREATE", this.onMessage);
          Dispatcher.subscribe("FRIEND_REQUEST_ACCEPTED", this.friendRequest);
        }

        getSettingsPanel() {
          return () => {
            const [state, dispatch] = BdApi.React.useReducer(currentState => {
              const newState = !currentState;
      
              this.xsoverlayenabled = newState;
              BdApi.saveData(config.info.name, "xsoverlayenabled", newState);
      
              return newState;

            }, this.xsoverlayenabled);
            const [statedm, dispatchdm] = BdApi.React.useReducer(currentState => {
              const newState = !currentState;
      
              this.xsoverlaydm = newState;
              BdApi.saveData(config.info.name, "xsoverlaydm", newState);
      
              return newState;

            }, this.xsoverlaydm);
            const [stateserver, dispatchserver] = BdApi.React.useReducer(currentState => {
              const newState = !currentState;
      
              this.xsoverlayserver = newState;
              BdApi.saveData(config.info.name, "xsoverlayserver", newState);
      
              return newState;

            }, this.xsoverlayserver);

            let settingsItems = [];

            settingsItems.push(BdApi.React.createElement(this.SwitchItem, {
              value: state,
              note: "Enable receiving Discord notifications through XSOverlay.",
              onChange: dispatch
            }, "Enable notifications"));

            settingsItems.push(BdApi.React.createElement(this.SwitchItem, {
              value: statedm,
              onChange: dispatchdm
            }, "Enable DMs"));

            settingsItems.push(BdApi.React.createElement(this.SwitchItem, {
              value: stateserver,
              onChange: dispatchserver
            }, "Enable servers"));
      
            return settingsItems;
          }
        }

        onMessage({ message }) {
          if(!this.xsoverlayenabled){
            return;
          }
          let finalMsg = message.content;
          const author = UserStore.getUser(message.author.id);
		      const channel = ChannelStore.getChannel(message.channel_id);
          const images = message.attachments.filter(
            (e) =>
              typeof e?.content_type === "string" &&
              e?.content_type.startsWith("image")
          );
          if (!this.supposedToNotify(message, channel)) return;
          let authorString = "";
          if (channel.guild_id) {
            const guild = GuildStore.getGuild(channel.guild_id);
            authorString = `${author.username} (${guild.name}, #${channel.name})`;
            if(!this.xsoverlayserver){
              return;
            }
          }
          if (channel.type === ChannelTypes["GROUP_DM"]) {
            authorString = `${author.username} (${channel.name})`;
			      if (!channel.name || channel.name === " " || channel.name === "") {
              authorString = `${author.username} (${channel.rawRecipients.map((e) => e.username).join(", ")})`;
            }
            if(!this.xsoverlaydm){
              return;
            }
          }
          if (channel.type === ChannelTypes["DM"]) {
            authorString = `${author.username}`;
            if(!this.xsoverlaydm){
              return;
            }
          }

          if (message.call) {
            finalMsg = "Started a call";
          }

          if (message.embeds.length !== 0) {
            finalMsg += " [embed] ";
            if (message.content === "") {
              finalMsg = "[embed]";
            }
          }

          if (message.stickers) {
            finalMsg += " [sticker] ";
            if (message.content === "") {
              finalMsg = "[sticker]";
            }
          }

          if (images[0]) {
            finalMsg += " [image] ";
          }
          else if (message.attachments.length !== 0){
            finalMsg += " [attachment] ";
          }

          const data = JSON.stringify({
            messageType: 1,
            index: 0,
            timeout: 5,
            height: calculateHeight(clearMessage(finalMsg)),
            opacity: 0.9,
            volume: 0,
            audioPath: '',
            title: authorString,
            content: clearMessage(finalMsg),
            useBase64Icon: false,
            icon: '',
            sourceApp: 'Discord'
          });
          sendToXSOverlay(data);
        }

        supposedToNotify(message, channel) {
          if (message.author.id === UserStore.getCurrentUser().id) return false;
          const isSuppressEveryone = MuteStore.isSuppressEveryoneEnabled(
            message.guild_id || "@me"
          );
          const isSuppressRoles = MuteStore.isSuppressRolesEnabled(
            message.guild_id || "@me"
          );
          if (MuteStore.allowAllMessages(channel)) return true;
          return isMentioned.isRawMessageMentioned(
            message,
            UserStore.getCurrentUser().id,
            isSuppressEveryone,
            isSuppressRoles
          );
        }

        friendRequest({ user }) {
          if(!this.xsoverlayenabled){
            return;
          }
          if (!this.settings.relationshipsNotis) return;
          user = UserStore.getUser(user.id);
          const data = JSON.stringify({
            messageType: 1,
            index: 0,
            timeout: 5,
            height: calculateHeight(clearMessage(formattedMessage)),
            opacity: 0.9,
            volume: 0,
            audioPath: '',
            title: user.tag,
            content: 'Accepted your friend request.',
            useBase64Icon: false,
            icon: '',
            sourceApp: 'Discord'
          });
          sendToXSOverlay(data);
        }

        onStop() {
          Dispatcher.unsubscribe("MESSAGE_CREATE", this.onMessage);
          Dispatcher.unsubscribe("FRIEND_REQUEST_ACCEPTED", this.friendRequest);
          Patcher.unpatchAll();
        }
      }

      return plugin;
    })(global.ZeresPluginLibrary.buildPlugin(config));
