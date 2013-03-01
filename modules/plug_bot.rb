# @author Chris Hall chall8908@gmail.com
#
# The Plug module contains everything necessary for operating the Plug dj bot
module Plug
  class BrowserRunningError < StandardError
  end

  class Logger
    @@log_file = File.join(Dir.pwd, "store", "bot.log")
    @@log_channel = nil

    # Set the IRC channel to be logged to
    #
    # @param channel [Cinch::Channel] the channel to log to
    def self.log_channel=(channel)
      @@log_channel = channel
    end

    # Log some piece of data.  Optionally, if set, output the data to an IRC channel
    #
    # @param entry [Object] an object implementing to_s
    def self.log(entry)
      max_log_size = 5242880 # 5MB

      File.new(FILES[:log], "w") unless File.exists? FILES[:log]

      unless File.size(FILES[:log]) < max_log_size
        File.rename FILES[:log], FILES[:log]+".#{Time.now}"

        # Remove old logfiles
        log_files = Dir.entries(Dir.pwd)
                    .select { |v| v.match(/bot\.log\./) }
                    .sort {|a, b|
                      a_time = Time.at a.split(".").last.to_i
                      b_time = Time.at b.split(".").last.to_i

                      a_time <=> b_time
                    }
        while log_files.length > 4 do
          File.delete log_files.pop
        end
      end

      @@log_channel.msg(entry) unless @@log_channel.nil?

      File.open(FILES[:log], "a+") {|f| f.write "#{DateTime.now.strftime "[%m/%d/%Y] %H:%M:%S"} - #{entry}\n"}
    end
  end

  class Bot

    #files and such
    FILES = {
              song: File.join(Dir.pwd, "store", "song.yml"),
              secrets: File.join(Dir.pwd, "store", "secrets.yml")
            }
    JS = File.read(File.join(Dir.pwd, "plug.js"))
    OPTIONS = YAML.load_file(FILES[:secrets])
    @@browser_running = false

    #Why are you calling new?  Retard....
    def initialize; raise; end

    # Start the browser loop.
    # Calls browser_setup to setup the browser instance
    #
    # @raise BrowserRunningError if the browser is already running
    def self.start_browser_loop
      raise BrowserRunningError.new if @@browser_running

      loop do
        browser_setup unless @@browser_running
        begin
          Watir::Wait.while(1) do
            still_alive = false
            begin
              still_alive = @@browser.window.exists?
              # check for session end alert
              if still_alive && (alert = @@browser.alert) && alert.exists?
                Logger.log "#{alert.text}"
                alert.ok
                still_alive = false
              end

            #this seems kinda hacky, but it works
            rescue StandardError => e
              Logger.log e
              still_alive = false
            end

            still_alive
          end
          Logger.log "browser is dead.  restarting..."
          #execution only reaches past here if the browser closes.  Otherwise, a TimeoutError is thrown and caught below
          @@browser_running = false

        rescue Watir::Wait::TimeoutError
          if @js_loaded
            @@browser.execute_script "RuB.heartbeat();"
            save_song_info @@browser.execute_script "return RuB.nowPlaying();"
            save_authorized_users @@browser.execute_script "return RuB.getAuthorizedUsers();"
            @@browser_running = !@@browser.execute_script("return RuB.restartRequested();")
          end
        end
      end
    end

    # Closes the browser gracefully
    def self.clean_up
      @@browser.close if @@browser && @@browser.exists?
    end

    private
    # Saves information on the current song to a file
    #
    # @param song [Hash] a hash of song information (See plug.js)
    def self.save_song_info(song)
      @current_song = song unless @current_song
      begin
        File.open(FILES[:song], "w+") { |f| f.write(song.to_yaml) }
      rescue Exception => e
        retry if fix_dir?
        Logger.log "unable to save current song."
        Logger.log e
      end
      if @current_song && @current_song["id"] != song["id"]
        @current_song = song
        Logger.log "now playing: #{@current_song["title"]} by #{@current_song["author"]}"
      end
    end

    # Saves the authorized users list to the secrets file
    #
    # @params users [Array<String>] an array of plug user ID strings (See plug.js)
    def self.save_authorized_users(users)
      if OPTIONS["users"].sort != users.sort
        Logger.log "updating authorized users list"
        OPTIONS["users"] = users
        begin
          File.open(FILES[:secrets], "w+") { |f| f.write(OPTIONS.to_yaml) }
        rescue Exception => e
        retry if fix_dir?
          Logger.log "unable to save authorized users."
          Logger.log e
        end
      end
    end

    # Sets up a browser instance and gets us to plug.dj
    def self.browser_setup
      Logger.log "setting up..."
      room = 'http://plug.dj/fractionradio/'

                                                                                # Make our browser instance, if we need it
      @@browser = Watir::Browser.new :firefox, profile: 'default' unless @@browser && @@browser.exists?

      @@browser.goto room                                                       # Try to load the room
      google_button = @@browser.div(id: "google")
      if google_button.exists?                                                  # Do we need to log in?
        Logger.log "logging in..."                                              # Yup
        google_button.click
        @@browser.text_field(id: "Email").set OPTIONS["email"]                  # provide email
        @@browser.text_field(id: "Passwd").set OPTIONS["pass"]                  # and pass
        @@browser.button(id: "signIn").click
        @@browser.wait                                                          # Wait for the lobby to load
        @@browser.goto room                                                     # head to our room
      end

      Logger.log "loading room..."
      @@browser.wait                                                            # Wait while the room loads

      begin
        Logger.log "injecting javascript..."
        @@browser.execute_script JS                                             # Inject Javascript
        @js_loaded = true
        Logger.log "setting authorized users..."
        @@browser.execute_script "RuB.setAuthorizedUsers(#{OPTIONS["users"]})"  # Set authorized users
      rescue Selenium::WebDriver::Error::JavascriptError => e
        Logger.log e                                                            # Something may go wrong (I'm not perfect, after all)
        @js_loaded = false
        if e.message.match("API is not defined")                                # If plug's API is not defined, we should be a little worried
          if @@browser.url != room                                              # Check that we're in the right place
            @@browser.goto room                                                 # If not, let's go there
            @@browser.wait
          else
            @@browser.execute_script "delete window.RuB"                        # If we are, delete the existing instance.  It failed to run anyways
          end

          retry                                                                 # Try loading the JS again
        end
      end

      Logger.log "loading last playing song"
      @current_song = YAML.load_file(FILES[:song])                              # Load up the song that was playing the last time we were here

      Logger.log "setup complete!"
      @@browser_running = true                                                  # ALL DONE!
    end

  end
end