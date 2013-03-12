# @author Chris Hall chall8908@gmail.com
#
# This logger is used to keep track of internal shit and send messages to IRC
module Plug
  class Logger
    require 'date'
    require 'cgi'

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
      entry = CGI.unescapeHTML(entry.to_s)
      max_log_size = 5242880 # 5MB

      File.new(@@log_file, "w") unless File.exists? @@log_file

      unless File.size(@@log_file) < max_log_size
        File.rename @@log_file, @@log_file+".#{Time.now}"

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

      File.open(@@log_file, "a+") {|f| f.write "#{DateTime.now.strftime "[%m/%d/%Y] %H:%M:%S"} - #{entry}\n"}
    end
  end
end