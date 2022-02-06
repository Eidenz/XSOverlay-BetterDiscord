/**
 * @name XSOverlay
 * @source https://github.com/Eidenz/XSOverlay-BetterDiscord/blob/main/XSOverlay.plugin.js
 * @updateUrl https://raw.githubusercontent.com/Eidenz/XSOverlay-BetterDiscord/main/XSOverlay.plugin.js
 * @version 1.0.1
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
    version: "1.0.1",
    description:
      "Adds support for XSOverlay using Notification API",
	},
  changelog: [
    {
      title: "Minor changes",
      items: ["Replacing ping & role IDs with a temporary string"]
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

        onStart() {
          Dispatcher.subscribe("MESSAGE_CREATE", this.onMessage);
          Dispatcher.subscribe("FRIEND_REQUEST_ACCEPTED", this.friendRequest);
        }

        onMessage({ message }) {
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
          }
          if (channel.type === ChannelTypes["GROUP_DM"]) {
            authorString = `${author.username} (${channel.name})`;
			    if (!channel.name || channel.name === " " || channel.name === "") {
              authorString = `${author.username} (${channel.rawRecipients.map((e) => e.username).join(", ")})`;
            }
          }
          if (channel.type === ChannelTypes["DM"]) {
            authorString = `${author.username}`;
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
