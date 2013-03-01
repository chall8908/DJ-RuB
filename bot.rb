#!/usr/bin/env ruby

require 'rubygems'
require 'daemons'
require 'yaml'
require 'watir-webdriver'
require 'headless'
require 'cinch'
require 'date'

module Logger
  
  #files and such
  FILES = {
            log: File.join(Dir.pwd, "store", "bot.log"),
            song: File.join(Dir.pwd, "store", "song.yml"),
            secrets: File.join(Dir.pwd, "store", "secrets.yml")
          }
            
  def files
    FILES
  end
  module_function :files
  
  def log(entry)
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

    @log_channel.msg(entry) unless @log_channel.nil?
    
    File.open(FILES[:log], "a+") {|f| f.write "#{DateTime.now.strftime "[%m/%d/%Y] %H:%M:%S"} - #{entry}\n"}
  end
  module_function :log

  def save_song_info(song)
    @current_song = song unless @current_song
    begin
      File.open(FILES[:song], "w+") { |f| f.write(song.to_yaml) }
    rescue Exception => e
      retry if fix_dir?
      log "unable to save current song."
      log e
    end
    if @current_song && @current_song["id"] != song["id"]
      @current_song = song
      log "now playing: #{@current_song["title"]} by #{@current_song["author"]}"
    end
  end
  module_function :save_song_info

  def save_authorized_users users
    if @options["users"].sort != users.sort
      log "updating authorized users list"
      @options["users"] = users
      begin
        File.open(FILES[:secrets], "w+") { |f| f.write(@options.to_yaml) }
      rescue Exception => e
      retry if fix_dir?
        log "unable to save authorized users."
        log e
      end
    end
  end
  module_function :save_authorized_users
  
end

# Determines if the current directory is fucked up and fixes it if it is
# @return [Boolean] true, if the directory was fixed.  false, if it didn't need to be fixed
def fix_dir?
  if Dir.pwd.match(/(unreachable)/)
    Logger.log "directory unreachable.  attempting to correct from #{Dir.pwd}."
    Dir.chdir Dir.pwd.gsub(/\(unreachable\)/, "").gsub(/\/\//, "/")
    true
  else
    false
  end
end

def browser_setup
  Logger.log "setting up..."
  room = 'http://plug.dj/fractionradio/'

  @browser = Watir::Browser.new :firefox, profile: 'default' unless @browser && @browser.exists?

  @browser.goto room
  google_button = @browser.div(id: "google")
  if google_button.exists?
    Logger.log "logging in..."
    google_button.click
    @browser.text_field(id: "Email").set @options["email"]
    @browser.text_field(id: "Passwd").set @options["pass"]
    @browser.button(id: "signIn").click
    @browser.wait
    @browser.goto room
  end

  Logger.log "loading room..."
  @browser.wait #waits until the DOMready event

  begin
    Logger.log "injecting javascript..."
    @browser.execute_script @js
    @js_loaded = true
    Logger.log "setting authorized users..."
    @browser.execute_script "RuB.setAuthorizedUsers(#{@options["users"]})"
  rescue Selenium::WebDriver::Error::JavascriptError => e
    Logger.log e
    @js_loaded = false
    if e.message.match("API is not defined")
      if @browser.url != room
        @browser.goto room
        @browser.wait
      else
        @browser.execute_script "delete window.RuB"
      end

      retry
    end
  end

  Logger.log "loading last playing song"
  @current_song = YAML.load_file(FILES[:song])

  Logger.log "setup complete!"
  @browser_running = true
end

@browser_running = false
@options = YAML.load_file(Logger.files[:secrets])
@js = File.read(File.join(Dir.pwd, "plug.js"))


begin
  Daemons.run_proc("bot", dir_mode: :script, dir: "store", backtrace: true, log_output: true, monitor: true) do
    Logger.log "daemon started"
    Headless.ly do
      @bot = Cinch::Bot.new do
        configure do |conf|          
          conf.nick = "DJ-RuB"
          conf.server = "irc.teamavolition.com"
          conf.channels = ["#!", "#radio"]
        end
        
        on :join do |e|
          @log_channel = @bot.channels.select{ |chan| chan.name == "#radio" }.first if e.channel == "#radio"
        end
        
        on :connect do |e|
          Logger.log "connected to IRC"
          Logger.log "initiating browser loop"
          
          loop do
            browser_setup unless @browser_running
            begin
              Watir::Wait.while(1) do
                still_alive = false
                begin
                  still_alive = @browser.window.exists?
                  # check for session end alert
                  if still_alive && (alert = @browser.alert) && alert.exists?
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
              @browser_running = false

            rescue Watir::Wait::TimeoutError
              if @js_loaded
                @browser.execute_script "RuB.heartbeat();"
                Logger.save_song_info @browser.execute_script "return RuB.nowPlaying();"
                Logger.save_authorized_users @browser.execute_script "return RuB.getAuthorizedUsers();"
                @browser_running = !@browser.execute_script("return RuB.restartRequested();")
              end
            end
          end
        end
      end
      
      Logger.log "connecting to IRC"
      @bot.start
    end
  end
rescue Exception => e
  Logger.log e
  @browser.close if @browser && @browser.exists?
end
