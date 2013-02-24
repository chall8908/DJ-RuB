#!/usr/bin/env ruby

require 'rubygems'
require 'daemons'
require 'yaml'
require 'watir-webdriver'
require 'headless'
require 'date'

#files and such
@file = {
          log: File.join(Dir.pwd, "store", "bot.log"),
          song: File.join(Dir.pwd, "store", "song.yml"),
          secrets: File.join(Dir.pwd, "store", "secrets.yml")
        }

@running = false
@options = YAML.load_file(@file[:secrets])
@js = File.read(File.join(Dir.pwd, "plug.js"))

def log(entry)
  max_log_size = 5242880 # 5MB

  File.new(@file[:log], "w") unless File.exists? @file[:log]

  unless File.size(@file[:log]) < max_log_size
    File.rename @file[:log], @file[:log]+".#{Time.now}"

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

  File.open(@file[:log], "a+") {|f| f.write "#{DateTime.now.strftime "[%m/%d/%Y] %H:%M:%S"} - #{entry}\n"}
end

def save_song_info(song)
  @current_song = song unless @current_song
  begin
    File.open(@file[:song], "w+") { |f| f.write(song.to_yaml) }
  rescue Exception => e
    retry if fix_dir?
    log "Unable to save current song."
    log e
  end
  if @current_song && @current_song.id != song.id
    @current_song = song
    log "Now Playing: #{@current_song.title} by #{@current_song.author}"
  end
end

def save_authorized_users users
  if @options["users"].sort != users.sort
    @options["users"] = users
    begin
      File.open(@file[:secrets], "w+") { |f| f.write(@options.to_yaml) }
    rescue Exception => e
    retry if fix_dir?
      log "Unable to save authorized users."
      log e
    end
  end
end

# Determines if the current directory is fucked up and fixes it if it is
# @return [Boolean] true, if the directory was fixed.  false, if it didn't need to be fixed
def fix_dir?
  if Dir.pwd.match(/(unreachable)/)
    log "Directory unreachable.  Attempting to correct from #{Dir.pwd}."
    Dir.chdir Dir.pwd.gsub(/\(unreachable\)/, "").gsub(/\/\//, "/")
    true
  else
    false
  end
end

def setup
  log "setting up..."
  room = 'http://plug.dj/fractionradio/'

  @browser = Watir::Browser.new unless @browser && @browser.exists?

  @browser.goto room
  google_button = @browser.div(id: "google")
  if google_button.exists?
    log "logging in..."
    google_button.click
    @browser.text_field(id: "Email").set @options["email"]
    @browser.text_field(id: "Passwd").set @options["pass"]
    @browser.button(id: "signIn").click
    @browser.wait
    @browser.goto room
  end

  log "loading room..."
  @browser.wait #waits until the DOMready event

  begin
    log "injecting javascript..."
    @browser.execute_script @js
    @js_loaded = true
    log "setting authorized users..."
    @browser.execute_script "RuB.setAuthorizedUsers(#{@options["users"]})"
  rescue Selenium::WebDriver::Error::JavascriptError => e
    log e
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

  log "setup complete!"
  @running = true
end

begin
  Daemons.run_proc("bot", dir_mode: :script, dir: "store", log_dir: "store", backtrace: true, log_output: true, monitor: true) do
    Headless.ly do
      loop do
        setup unless @running
        begin
          Watir::Wait.while do
            still_alive = false
            begin
              still_alive = @browser.window.exists?
              # check for session end alert
              if still_alive && (alert = @browser.alert) && alert.exists?
                log "#{alert.text}"
                alert.ok
                still_alive = false
              end

            #this seems kinda hacky, but it works
            rescue Exception => e
              raise e if e.message == "exit"

              log e
              still_alive = false
            end

            still_alive
          end
          log "browser is dead.  restarting..."
          #execution only reaches past here if the browser closes.  Otherwise, a TimeoutError is thrown and caught below
          @running = false

        rescue Watir::Wait::TimeoutError
          if @js_loaded
            @browser.execute_script "RuB.heartbeat();"
            save_song_info @browser.execute_script "return RuB.nowPlaying();"
            save_authorized_users @browser.execute_script "return RuB.getAuthorizedUsers();"
            @running = !@browser.execute_script("return RuB.restartRequested();")
          end
        end
      end
    end
  end
rescue Exception => e
  log e
  @browser.close if @browser && @browser.exists?
end
