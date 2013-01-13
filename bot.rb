require 'rubygems'
require 'daemons'
require 'yaml'
require 'watir-webdriver'
require 'headless'
require 'date'

@running = false
@options = YAML.load_file(File.join(Dir.pwd, "store", "secrets.yml"))
js_file = File.open(File.join(Dir.pwd, "plug.js"))
@js = js_file.read
js_file.close
js_file = nil
@log_file = File.join(Dir.pwd, "store", "bot.log")

def setup
  log "setting up..."

  @browser = Watir::Browser.start 'http://plug.dj/fractionradio/'
  google_button = @browser.div(id: "google")
  if google_button.exists?
    google_button.click
    @browser.text_field(id: "Email").set @options["email"]
    @browser.text_field(id: "Passwd").set @options["pass"]
    @browser.button(id: "signIn").click
    @browser.goto 'http://plug.dj/fractionradio/'
  end
  begin
    @browser.execute_script @js
    @js_loaded = true
    @browser.execute_script "RuB.setAuthorizedUsers(#{@options["users"].to_json})"
  rescue Selenium::WebDriver::Error::JavascriptError => e
    log e
  end

  log "setup complete!"
end

def log(entry)
  max_log_size = 5242880 # 5MB
  
  File.new(@log_file, "w") unless File.exists? @log_file
  
  unless File.size(@log_file) < max_log_size
    File.rename @log_file, @log_file+".#{Time.now}"
    
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
  
  File.open(@log_file, "a+") {|f| f.write "#{DateTime.now.strftime "[%m/%d/%Y] %H:%M:%S"} - #{entry}\n"}
end

def save_song_info(song)
  begin
    File.open(File.join(Dir.pwd, "store", "song.yml"), "w+") { |f| f.write(song.to_yaml) }
  rescue
    retry if fix_dir?
  end
end

def save_authorized_users users
  if @options["users"].sort != users.sort
    @options["users"] = users
    begin
      File.open(File.join(Dir.pwd, "store", "secrets.yml"), "w+") { |f| f.write(@options.to_yaml) }
    rescue
      retry if fix_dir?
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

Daemons.run_proc("DJ-RuB") do
  Headless.ly do
    loop do
      setup unless @running
      begin
        @browser.wait_while do
          sill_alive = nil
          begin
            still_alive = @browser.window.exists?

          #this seems kinda hacky, but it works
          rescue
            still_alive = false
          end

          still_alive
        end
        #execution only reaches past here if the browser closes.  Otherwise, a TimeoutError is thrown and caught below
        @running = false
        
      rescue Watir::Wait::TimeoutError
        if @js_loaded
          @browser.execute_script("RuB.heartbeat();")
          save_song_info @browser.execute_script("return RuB.nowPlaying();")
          save_authorized_users @browser.execute_script("return RuB.getAuthorizedUsers();")
        end
        @running = true
      end
    end
  end
end